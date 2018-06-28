// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/example-todo
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Entity, ModelDefinition} from '@loopback/repository';
const modelDef = require('../todo.model.json');

export class TodoBase extends Entity {
  static definition = new ModelDefinition(modelDef);

  id?: number;
  title: string;
  desc?: string;
  isComplete: boolean;
  remindAtAddress?: string;
  remindAtGeo?: string;
}
