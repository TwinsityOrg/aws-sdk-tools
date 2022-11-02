#!/usr/bin/env node

const { program } = require('commander');
const { updateEcsServiceImage } = require('./modules/update-ecs-server-image');

const defaultRegion = 'eu-central-1';

const main = async () => {
  program
    .name('update-ecs-service-image')
    .description('CLI to update an ECS service to get the most recent version via a task definition')
    .requiredOption('-s, --service <name>', 'the specific service name of the ECS service')
    .requiredOption('-c, --cluster <name>', 'the name of the ECS Cluster')
    .requiredOption('-i, --image <image>', 'the image to be used in the ECS cluster')
    .requiredOption('-f, --family <family>', 'the name for the ECS task definition family')
    .option('-r, --region <region>', 'the region to deploy to', defaultRegion)
    .option('-p, --profile <profileName>', 'the AWS SSO profile to be used');
  program.parse();
  const options = program.opts();

  await updateEcsServiceImage(options);
};

main();
