// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  RequestBodyObject,
  SchemaObject,
  SchemasObject,
} from '@loopback/openapi-v3-types';
import * as AJV from 'ajv';
import * as debugModule from 'debug';
import * as util from 'util';
import {HttpErrors} from '..';
import {RestHttpErrors} from '..';
import * as _ from 'lodash';

const toJsonSchema = require('openapi-schema-to-json-schema');
const debug = debugModule('loopback:rest:validation');

export function validateRequestBody(
  // tslint:disable-next-line:no-any
  body: any,
  requestBodySpec: RequestBodyObject | undefined,
  globalSchemas?: SchemasObject,
) {
  if (requestBodySpec && requestBodySpec.required && body == undefined)
    throw new HttpErrors.BadRequest('Request body is required');

  const schema = getRequestBodySchema(requestBodySpec);
  debug('Request body schema: %j', util.inspect(schema, {depth: null}));
  if (!schema) return;

  const jsonSchema = convertToJsonSchema(schema);
  validateValueAgainstJsonSchema(body, jsonSchema, globalSchemas);
}

function getRequestBodySchema(
  requestBodySpec: RequestBodyObject | undefined,
): SchemaObject | undefined {
  if (!requestBodySpec) return;

  const content = requestBodySpec.content;
  // FIXME(bajtos) we need to find the entry matching the content-type
  // header from the incoming request (e.g. "application/json").
  return content[Object.keys(content)[0]].schema;
}

function convertToJsonSchema(openapiSchema: SchemaObject) {
  const jsonSchema = toJsonSchema(openapiSchema);
  delete jsonSchema['$schema'];
  debug(
    'Converted OpenAPI schema to JSON schema: %s',
    util.inspect(jsonSchema, {depth: null}),
  );
  return jsonSchema;
}

function validateValueAgainstJsonSchema(
  // tslint:disable-next-line:no-any
  body: any,
  // tslint:disable-next-line:no-any
  schema: any,
  globalSchemas?: SchemasObject,
) {
  let schemaWithRef = _.cloneDeep(schema);
  schemaWithRef.components = {
    schemas: globalSchemas,
  };

  const ajv = new AJV({
    allErrors: true,
  });
  try {
    if (ajv.validate(schemaWithRef, body)) {
      debug('Request body passed AJV validation.');
      return;
    }
  } catch (err) {
    debug('Cannot execute AJV validation: %s', util.inspect(err));
  }

  debug('Invalid request body: %s', util.inspect(ajv.errors));
  const message = ajv.errorsText(ajv.errors, {dataVar: body});
  // FIXME add `err.details` object containing machine-readable information
  // see LB 3.x ValidationError for inspiration
  throw RestHttpErrors.invalidRequestBody(message);
}
