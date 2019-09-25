const path = require('path');
const process = require('process');
const fs = require('fs').promises;

import * as yaml from 'js-yaml';
import stringArgv from 'string-argv';
import * as core from '@actions/core';
import {input} from '@actions-rs/core';


/**
 * These value are defined by the Action inputs
 */
export interface Input {
    // `cargo test` args
    testArgs: string[],
    // Absolute path
    configPath?: string,
}

/**
 * These values are defined by users through the YAML configuration.
 */
export interface User {
    branch?: boolean,
    ignoreNotExisting?: boolean,
    llvm?: boolean,
    filter?: 'covered' | 'uncovered',
    ignoreDir?: string[],
    outputType?: 'lcov' | 'coveralls' | 'coveralls+' | 'ade' | 'files',
    pathMapping?: string[],
    prefixDir?: string,
}

/**
 * And these are automatically gathered from the env vars
 */
export interface System {
    // GITHUB_WORKSPACE
    workspace: string,
    // GITHUB_SHA
    commitSha: string,
    // GITHUB_REF ?
    branch: string,
    // GITHUB_WORKFLOW
    serviceName: string,
}

/**
 * Configuration: The Gathering.
 */
export interface Config {
    inputs: Input,
    user: User,
    system: System,
}

function getEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable "${name}" is not defined`);
    }

    return value;
}

function loadInputs(): Input {
    if (!process.env.GITHUB_WORKSPACE) {
        throw new Error('Environment variable GITHUB_WORKSPACE is undefined. \
Did you forgot to checkout the code first?');
    }

    let inputs: Input = {
        testArgs: ['test'].concat(stringArgv(input.getInput('args'))),
    };

    const relConfigPath = input.getInput('config');
    if (relConfigPath.length > 0) {
        inputs.configPath = path.join(
            process.env.GITHUB_WORKSPACE!,
            relConfigPath
        );
    }

    return inputs;
}

async function loadUser(path: string): Promise<User> {
    let contents = {};
    try {
        contents = yaml.safeLoad(await fs.readFile(path));
    } catch (error) {
        core.warning(`Unable to load grcov config from the ${path}, falling back to defaults. ${error}`);
    }

    let user: User = {};
    if (contents['branch'] == true) {
        user.branch = true;
    }
    if (contents['ignore-not-existing'] == true) {
        user.ignoreNotExisting = true;
    }
    if (contents['llvm'] == true) {
        user.llvm = true;
    }
    if (contents['filter']) {
        user.filter = contents['filter'];
    }
    if (contents['ignore-dir'] && Array.isArray(contents['ignore-dir'])) {
        user.ignoreDir = contents['ignore-dir'];
    }
    if (contents['output-type']) {
        user.outputType = contents['output-type'];
    }
    if (contents['path-mapping'] && Array.isArray(contents['path-mapping'])) {
        user.pathMapping = contents['path-mapping'];
    }
    if (contents['prefix-dir']) {
        user.prefixDir = contents['prefix-dir'];
    }

    core.debug(`Parsed grcov configuration: ${user}`);

    return user;
}

async function loadSystem(): Promise<System> {
    return {
        workspace: getEnv('GITHUB_WORKSPACE'),
        commitSha: getEnv('GITHUB_SHA'),
        branch: getEnv('GITHUB_REF'),
        serviceName: getEnv('GITHUB_WORKFLOW'),
    }
}

export async function load(): Promise<Config> {
    const inputs = loadInputs();
    const system = await loadSystem();
    let user = {};
    if (inputs.configPath) {
        user = await loadUser(inputs.configPath);
    }

    return {
        inputs: inputs,
        user: user,
        system: system,
    }
}
