#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
import core from '@actions/core';
import _ from 'lodash';
import { copyBuildFolderToS3 } from '../../src/modules/copy-spa-to-S3';

const main = async () => {
  const stage = _.lowerCase(core.getInput('stage', { required: true }));
  const project = _.lowerCase(core.getInput('project', { required: true }));
  const app = _.lowerCase(core.getInput('app', { required: true }));
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
