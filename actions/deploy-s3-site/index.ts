#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
import * as core from '@actions/core';
import * as _ from 'lodash';
import { copyBuildFolderToS3 } from '../../src/modules/copy-spa-to-S3';

const main = async (): Promise<void> => {
  const stage = core.getInput('stage', { required: true });
  const project = _.camelCase(core.getInput('project', { required: true }));
  const app = _.camelCase(core.getInput('app', { required: true }));
  const buildPath = core.getInput('buildPath', { required: true });
  const apexDomain = core.getInput('apexDomain', { required: true });
  const appSubDomain = core.getInput('appSubDomain');
  const tagsFileLocation = core.getInput('tagsFileLocation');
  const removeBucketFiles = core.getBooleanInput('removeBucketFiles');

  const bucketName = `${project}-${app}-${_.camelCase(stage)}`;
  const stageSubDomain = stage;
  const fullDomain = appSubDomain
    ? `${appSubDomain}.${stageSubDomain}.${apexDomain}`
    : `${stageSubDomain}.${apexDomain}`;

  const options = {
    bucketName,
    buildDir: buildPath,
    removeBucketFiles,
    host: fullDomain,
    tagsFileLocation,
  };
  console.dir(options);
  await copyBuildFolderToS3(options);
};

main();
