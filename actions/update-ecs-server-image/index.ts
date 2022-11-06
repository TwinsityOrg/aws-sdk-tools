#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
import * as core from '@actions/core';
import * as _ from 'lodash';
import { updateEcsServiceImage } from '../../src/modules/update-ecs-server-image';

const main = async (): Promise<void> => {
  const service = core.getInput('service', { required: true });
  const family = core.getInput('family', { required: true });
  const image = core.getInput('image', { required: true });
  const cluster = core.getInput('cluster', { required: true });
  const version = core.getInput('version');
  const versionMsg = core.getInput('versionMsg');

  const options = {
    service,
    family,
    image,
    cluster,
  };
  core.info(`${options}`);
  try {
    await updateEcsServiceImage(options);
  } catch (e) {
    core.error(e);
  }
};

main();
