/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { ECS } from 'aws-sdk';
import * as fs from 'fs';

export interface UpdateEcsServiceImageOptions {
  profile?: string;
  service: string;
  region?: string;
  cluster: string;
  image: string;
  family: string;
  tagsFileLocation?: string;
}
export const updateEcsServiceImage = async (options: UpdateEcsServiceImageOptions) => {
  const { profile, service, region, cluster, image, family, tagsFileLocation } = options;

  let newTags;
  if (tagsFileLocation) {
    const tags = JSON.parse(fs.readFileSync(tagsFileLocation).toString('utf-8'));
    newTags = Object.entries(tags).map(([k, v]) => {
      // the value has to be a string
      return { Key: k, Value: `${v}` };
    });
    console.log('newTags');
    console.dir(newTags);
  }

  let ecs: ECS;
  if (profile) {
    console.log(`using SSO profile: ${profile}`);
    const credentials = await fromSSO({ profile: profile })();
    ecs = new ECS({
      credentials: credentials,
      region: region,
    });
  } else {
    ecs = new ECS();
  }

  const listTaskDefs = await ecs
    .listTaskDefinitions({
      familyPrefix: family,
      maxResults: 1,
    })
    .promise();

  //listTaskDef.taskDefinitionArns.find((taskDef) => taskDef.includes(family));
  const oldTaskDefArn = listTaskDefs.taskDefinitionArns[0];
  if (!oldTaskDefArn) {
    throw new Error('Task Definition ARN not found');
  }

  console.log(`found task definition ARN: ${oldTaskDefArn}`);
  const taskDefResponse = await ecs
    .describeTaskDefinition({
      taskDefinition: oldTaskDefArn,
    })
    .promise();

  if (!taskDefResponse.taskDefinition) {
    throw new Error(`No existing task definiton found, matching ${family} ... please deploy infrastructure first!`);
  }
  const { taskDefinition } = taskDefResponse;
  const oldTaskDefinition = taskDefinition.containerDefinitions[0];
  oldTaskDefinition.image = image;

  const newTaskDefinitionResponse = await ecs
    .registerTaskDefinition({
      containerDefinitions: [oldTaskDefinition],
      family,
      tags: newTags,
    })
    .promise();
  if (!newTaskDefinitionResponse.taskDefinition) {
    console.log(newTaskDefinitionResponse.$response.error);
    throw new Error(
      `Could not register new/updated task definition. reason: ${newTaskDefinitionResponse.$response.error}`
    );
  }
  const newTaskDefinition = newTaskDefinitionResponse.taskDefinition;

  const ecsUpdateResponse = await ecs
    .updateService({
      taskDefinition: newTaskDefinition.taskDefinitionArn,
      forceNewDeployment: true,
      service,
      cluster,
      propagateTags: 'TASK_DEFINITION',
      enableECSManagedTags: true,
    })
    .promise();
  console.log(`ECS update triggered`, ecsUpdateResponse.service);

  const oldTaskDefDeregistrationResponse = await ecs
    .deregisterTaskDefinition({
      taskDefinition: oldTaskDefArn,
    })
    .promise();

  const oldTaskDefinitionStatus = oldTaskDefDeregistrationResponse.taskDefinition.status;
  console.log(`Deregistered old task Definition ${oldTaskDefArn}, updated status: ${oldTaskDefinitionStatus}`);
};

const updateExistingTags = (existingTags, newTags) => {
  const mergedObj = {};

  existingTags.forEach((existingObj) => {
    mergedObj[existingObj.Key] = existingObj.Value;
  });

  newTags.forEach((newTag) => {
    mergedObj[newTag.Key] = newTag.Value;
  });

  const mergedTags = Object.entries(mergedObj).map(([key, value]) => ({
    Key: key,
    Value: `${value}`,
  }));

  return mergedTags;
};
