#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
import * as core from '@actions/core';
import * as _ from 'lodash';
import { copyBuildFolderToS3 } from '../../src/modules/copy-spa-to-S3';

const main = async (): Promise<void> => {
  const stage = _.camelCase(core.getInput('stage', { required: true }));
  const project = _.camelCase(core.getInput('project', { required: true }));
  const app = _.camelCase(core.getInput('app', { required: true }));
  const buildPath = core.getInput('buildPath', { required: true });
  const fullDomain = core.getInput('fullDomain', { required: true });
  const removeBucketFiles = core.getBooleanInput('removeBucketFiles');
  const version = core.getInput('version');
  const versionMsg = core.getInput('versionMsg');

  const bucketName = `${project}-${app}-${stage}`;

  const options = {
    bucketName,
    buildDir: buildPath,
    removeBucketFiles,
    host: fullDomain,
    version,
    versionMsg,
  };
  core.info(`${options}`);
  await copyBuildFolderToS3(options);
};

main();
