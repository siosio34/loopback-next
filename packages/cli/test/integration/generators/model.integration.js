// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

('use strict');

// Imports
const path = require('path');
const assert = require('yeoman-assert');
const testlab = require('@loopback/testlab');

const expect = testlab.expect;
const TestSandbox = testlab.TestSandbox;

// const ModelGenerator = require('../../../generators/model');
const generator = path.join(__dirname, '../../../generators/model');
const tests = require('../lib/artifact-generator')(generator);
const baseTests = require('../lib/base-generator')(generator);
const testUtils = require('../../test-utils');

// Test Sandbox
const SANDBOX_PATH = path.resolve(__dirname, '../.sandbox');
const sandbox = new TestSandbox(SANDBOX_PATH);

// Basic CLI Input
const basicCLIInput = {
  name: 'test',
};

// Expected File Paths & File Contents
const expectedBaseIndexFile = path.join(
  SANDBOX_PATH,
  'src/models/_generated/index.ts',
);
const expectedIndexFile = path.join(SANDBOX_PATH, 'src/models/index.ts');
const expectedModelBaseFile = path.join(
  SANDBOX_PATH,
  'src/models/_generated/test.base.model.ts',
);
const expectedModelFile = path.join(SANDBOX_PATH, 'src/models/test.model.ts');
const expectedJSONFile = path.join(SANDBOX_PATH, 'src/models/test.model.json');
const expectedJSONContents = {
  name: 'Test',
  extends: 'Entity',
  properties: {},
};

// Base Tests
describe('model-generator extending BaseGenerator', baseTests);
describe('generator-loopback4:model', tests);

describe('lb4 model integration', () => {
  beforeEach('reset sandbox', () => sandbox.reset());

  it('does not run without package.json', () => {
    return expect(
      testUtils
        .executeGenerator(generator)
        .inDir(SANDBOX_PATH, () =>
          testUtils.givenLBProject(SANDBOX_PATH, {excludePackageJSON: true}),
        )
        .withPrompts(basicCLIInput),
    ).to.be.rejectedWith(/No package.json found in/);
  });

  it('does not run without the loopback keyword', () => {
    return expect(
      testUtils
        .executeGenerator(generator)
        .inDir(SANDBOX_PATH, () =>
          testUtils.givenLBProject(SANDBOX_PATH, {excludeKeyword: true}),
        )
        .withPrompts(basicCLIInput),
    ).to.be.rejectedWith(/No `loopback` keyword found in/);
  });

  describe('model generator', () => {
    it('scaffolds correct files with input', async () => {
      await testUtils
        .executeGenerator(generator)
        .inDir(SANDBOX_PATH, () => testUtils.givenLBProject(SANDBOX_PATH))
        .withPrompts({
          name: 'test',
          propName: null,
        });

      checkModelFiles();
    });

    it('scaffolds correct files with args', async () => {
      await testUtils
        .executeGenerator(generator)
        .inDir(SANDBOX_PATH, () => testUtils.givenLBProject(SANDBOX_PATH))
        .withArguments('test')
        .withPrompts({
          propName: null,
        });

      checkModelFiles();
    });
  });
});

// Checks to ensure expected files exist with the current file contents
function checkModelFiles() {
  assert.file(expectedModelFile);
  assert.file(expectedModelBaseFile);
  assert.file(expectedIndexFile);
  assert.file(expectedBaseIndexFile);
  assert.file(expectedJSONFile);

  // Base File
  assert.fileContent(
    expectedModelBaseFile,
    /import {Entity, ModelDefinition} from '@loopback\/repository';/,
  );
  assert.fileContent(
    expectedModelBaseFile,
    /const modelDef = require\('..\/test.model.json'\);/,
  );
  assert.fileContent(
    expectedModelBaseFile,
    /export class TestBase extends Entity {/,
  );
  assert.fileContent(
    expectedModelBaseFile,
    /static definition = new ModelDefinition\(modelDef\);/,
  );

  // Base Index File
  assert.fileContent(
    expectedBaseIndexFile,
    /export \* from '.\/test.base.model';/,
  );

  // Actual Model File
  assert.fileContent(
    expectedModelFile,
    /import {TestBase} from '.\/_generated';/,
  );
  assert.fileContent(
    expectedModelFile,
    /export class Test extends TestBase {}/,
  );

  // Actual Index File
  assert.fileContent(expectedIndexFile, /export \* from '.\/test.model';/);

  // JSON File
  assert.jsonFileContent(expectedJSONFile, expectedJSONContents);
}
