#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { ECS } = require('aws-sdk');
const { fromSSO } = require('@aws-sdk/credential-provider-sso');
const { program } = require('commander');

const defaultRegion = 'eu-west-1';

const main = async () => {
  program
    .name('update-ecs-service-image')
    .description('CLI to update an ECS service and get the most recent image version')
    .requiredOption('-s, --service <name>', 'the specific service name of the ECS service')
    .requiredOption('-c, --cluster <name>', 'the name of the ECS Cluster')
    .option('-r,--region <region>', 'the region to deploy to', defaultRegion)
    .option('-p, --profile <profileName>', 'the AWS SSO profile to be used');
  program.parse();
  const options = program.opts();

  const { profile, service, region, cluster } = options;

  let ecs;
  if (profile) {
    console.log(`using SSO profile: ${profile}`);
    const credentials = await fromSSO({ profile: profile })();
    ecs = new ECS({
      credentials: credentials,
      region: region,
    });
  } else {
    ecs = new ECS({
      region,
    });
  }

  const ecsUpdateResponse = await ecs
    .updateService({
      forceNewDeployment: true,
      service,
      cluster,
    })
    .promise();
  console.log(`ECS update triggered`, ecsUpdateResponse.service);
};

main();
