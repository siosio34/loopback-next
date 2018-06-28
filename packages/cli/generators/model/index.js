// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const ArtifactGenerator = require('../../lib/artifact-generator');
const debug = require('../../lib/debug')('model-generator');
const utils = require('../../lib/utils');
const updateIndex = require('../../lib/update-index');
const chalk = require('chalk');
const path = require('path');
const _ = require('lodash');

/**
 * Model Generator == CLI
 *
 * Prompts for a Model name, Model Base Class (currently defaults to 'Entity').
 * Creates json file, a Base class for the model as well as a Class for a user
 * to modify.
 *
 * Will prompt for properties to add to the Model till a blank property name is
 * entered. Will also ask if a property is required, the default value for the
 * property, if it's the ID (unless one has been selected), etc.
 */
module.exports = class ModelGenerator extends ArtifactGenerator {
  constructor(args, opts) {
    super(args, opts);
  }

  _setupGenerator() {
    this.artifactInfo = {
      type: 'model',
      rootDir: 'src',
    };

    this.artifactInfo.outDir = path.resolve(
      this.artifactInfo.rootDir,
      'models',
    );

    // Model Property Types
    this.typeChoices = [
      'string',
      'number',
      'boolean',
      'object',
      'array',
      'date',
      'buffer',
      'geopoint',
      'any',
    ];

    this.artifactInfo.properties = {};

    return super._setupGenerator();
  }

  checkLoopBackProject() {
    return super.checkLoopBackProject();
  }

  promptArtifactName() {
    return super.promptArtifactName();
  }

  promptBase() {
    this.artifactInfo.className = utils.toClassName(this.artifactInfo.name);
    const baseOptions = ['Entity'];
    const prompts = [
      {
        name: 'base',
        message: `Select the base class for ${chalk.yellow(
          this.artifactInfo.className,
        )}:`,
        type: 'list',
        default: baseOptions[0],
        choices: baseOptions,
        when: baseOptions.length > 1,
      },
    ];

    return this.prompt(prompts).then(props => {
      if (!props.base) props.base = baseOptions[0];
      Object.assign(this.artifactInfo, props);

      this.log(
        `Let's add a property to ${chalk.yellow(this.artifactInfo.className)}`,
      );

      return props;
    });
  }

  // Prompt for a property name
  promptPropertyName() {
    this.log(`Enter an empty property name when done`);

    delete this.propName;
    const prompts = [
      {
        name: 'propName',
        message: 'Enter the property name:',
        validate: function(val) {
          if (val) {
            return utils.checkPropertyName(val);
          } else {
            return true;
          }
        },
      },
    ];

    return this.prompt(prompts).then(props => {
      if (props.propName) {
        this.artifactInfo.properties[props.propName] = {};
        this.propName = props.propName;
      }
      return this._promptPropertyInfo();
    });
  }

  // Internal Method. Called when a new property is entered.
  // Prompts the user for more information about the property to be added.
  _promptPropertyInfo() {
    if (!this.propName) {
      return true;
    } else {
      const prompts = [
        {
          name: 'type',
          message: 'Property type:',
          type: 'list',
          choices: this.typeChoices,
        },
        {
          name: 'arrayType',
          message: 'Type of array items:',
          type: 'list',
          choices: this.typeChoices.filter(choice => {
            return choice !== 'array';
          }),
          when: function(answers) {
            return answers.type === 'array';
          },
        },
        {
          name: 'id',
          message: 'Is ID field?',
          type: 'confirm',
          default: false,
          when: function(answers) {
            return (
              !this.idFieldSet &&
              !['array', 'object', 'buffer'].includes(answers.type)
            );
          }.bind(this),
        },
        {
          name: 'required',
          message: 'Required?:',
          type: 'confirm',
          default: false,
        },
        {
          name: 'default',
          message: `Default value ${chalk.yellow('[leave blank for none]')}:`,
          when: function(answers) {
            return (
              ![null, 'buffer', 'any'].includes(answers.type) &&
              this.typeChoices.includes(answers.type)
            );
          }.bind(this),
        },
      ];

      return this.prompt(prompts).then(props => {
        if (props.default === '') {
          delete props.default;
        }

        Object.assign(this.artifactInfo.properties[this.propName], props);
        if (props.id) {
          this.idFieldSet = true;
        }

        this.log(
          `Let's add another property to ${chalk.yellow(
            this.artifactInfo.className,
          )}`,
        );
        return this.promptPropertyName();
      });
    }
  }

  scaffold() {
    if (this.shouldExit()) return false;

    // Data for templates
    this.artifactInfo.baseClassName = `${this.artifactInfo.className}Base`;
    this.artifactInfo.fileName = utils.kebabCase(this.artifactInfo.name);
    this.artifactInfo.jsonFileName = `${this.artifactInfo.fileName}.model.json`;
    // prettier-ignore
    this.artifactInfo.baseOutFile = `${this.artifactInfo.fileName}.base.model.ts`;
    this.artifactInfo.outFile = `${this.artifactInfo.fileName}.model.ts`;

    // Resolved Output Paths
    const jsonPath = this.destinationPath(
      this.artifactInfo.outDir,
      this.artifactInfo.jsonFileName,
    );
    const tsPath = this.destinationPath(
      this.artifactInfo.outDir,
      this.artifactInfo.outFile,
    );
    const baseTsPath = this.destinationPath(
      this.artifactInfo.outDir,
      '_generated',
      this.artifactInfo.baseOutFile,
    );

    this.artifactInfo.updateIndexes = [
      {dir: this.artifactInfo.outDir, file: this.artifactInfo.outFile},
      {
        dir: path.resolve(this.artifactInfo.outDir, '_generated'),
        file: this.artifactInfo.baseOutFile,
      },
    ];

    const baseModelTemplatePath = this.templatePath('base.model.ts.ejs');
    const modelTemplatePath = this.templatePath('model.ts.ejs');

    // Model JSON
    const model = _.cloneDeep({
      name: this.artifactInfo.className,
      extends: this.artifactInfo.base,
      properties: this.artifactInfo.properties,
    });

    // Set up types for Templating
    const TS_TYPES = ['string', 'number', 'object', 'boolean', 'any'];
    const NON_TS_TYPES = ['geopoint', 'date'];
    Object.entries(this.artifactInfo.properties).forEach(([key, val]) => {
      val.tsType = val.type;
      if (val.type === 'array') {
        if (TS_TYPES.includes(val.arrayType)) {
          val.tsType = `${val.arrayType}[]`;
        } else if (val.type === 'buffer') {
          val.tsType = `Buffer[]`;
        } else {
          val.tsType = `string[]`;
        }
      } else if (val.type === 'buffer') {
        val.tsType = 'Buffer';
      }

      if (NON_TS_TYPES.includes(val.tsType)) {
        val.tsType = 'string';
      }
    });

    this.fs.writeJSON(jsonPath, model);
    this.fs.copyTpl(baseModelTemplatePath, baseTsPath, this.artifactInfo);
    this.fs.copyTpl(modelTemplatePath, tsPath, this.artifactInfo);
  }

  async end() {
    await super.end();
  }
};
