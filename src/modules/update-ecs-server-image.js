/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { ECS } = require('aws-sdk');
const { fromSSO } = require('@aws-sdk/credential-provider-sso');

export const updateEcsServiceImage = async (options) => {
  const { profile, service, region, cluster, image, family } = options;

  let ecs;
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
  taskDefinition.containerDefinitions[0].image = image;

  const {
    taskDefinitionArn,
    revision,
    status,
    requiresAttributes,
    compatibilities,
    registeredAt,
    registeredBy,
    ...taskDefParams
  } = taskDefinition;

  const newTaskDefinitionResponse = await ecs
    .registerTaskDefinition({
      ...taskDefParams,
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
