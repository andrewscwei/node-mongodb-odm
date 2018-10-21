import is from '@sindresorhus/is';
import assert from 'assert';
import { ObjectID } from 'mongodb';
import { SchemaField, SchemaFieldType } from '../types/Schema';

/**
 * Checks a value against field properties definied in a schema.
 *
 * @param value - The value to check.
 * @param specs - Schema field definition.
 *
 * @return `true` if validation passes, `false` otherwise.
 */
export default function validate(value: any, specs: SchemaField): boolean {
  const errorPrefix = `[validate(${value}, ${JSON.stringify(specs)}]`;

  try {
    // Check if value is undefined or null, then respond accordingly depending on
    // whether or not it is a required value.
    if (is.nullOrUndefined(value)) {
      if (specs.required) {
        throw new TypeError(`${errorPrefix} The value is required but it is undefined`);
      }
      else {
        return true;
      }
    }

    switch (specs.type) {
    case String:
      assert(is.string(value), new TypeError(`${errorPrefix} Value is expected to be a string`));

      if (is.regExp(specs.validate)) {
        assert(specs.validate.test(value), new TypeError(`${errorPrefix} The value must conform to the regex ${specs.validate}`));
      }
      else if (is.number(specs.validate)) {
        assert(value.length <= specs.validate, new TypeError(`${errorPrefix} The length of the value must be less than or equal to ${specs.validate}`));
      }
      else if (is.array(specs.validate)) {
        assert(specs.validate.indexOf(value) > -1, new TypeError(`${errorPrefix} The value is not an element of ${specs.validate}`));
      }

      break;
    case Number:
      assert(is.number(value), new TypeError(`${errorPrefix} Value is expected to be a number`));

      if (is.regExp(specs.validate)) {
        throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
      }
      else if (is.number(specs.validate)) {
        assert(value <= specs.validate, new TypeError(`${errorPrefix} The value must be less than or equal to ${specs.validate}`));
      }
      else if (is.array(specs.validate)) {
        assert(specs.validate.indexOf(value) > -1, new TypeError(`${errorPrefix} The value is not an element of ${specs.validate}`));
      }

      break;
    case Boolean:
      assert(is.boolean(value), new TypeError(`${errorPrefix} Value is expected to be a boolean`));

      if (is.regExp(specs.validate)) {
        throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
      }
      else if (is.number(specs.validate)) {
        throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
      }
      else if (is.array(specs.validate)) {
        assert(specs.validate.indexOf(value) > -1, new TypeError(`${errorPrefix} The value is not an element of ${specs.validate}`));
      }

      break;
    case Date:
      assert(is.date(value), new TypeError(`${errorPrefix} Value is expected to be a date`));

      if (is.regExp(specs.validate)) {
        throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
      }
      else if (is.number(specs.validate)) {
        throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
      }
      else if (is.array(specs.validate)) {
        throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
      }

      break;
    case Array:
      assert(is.array(value), new TypeError(`${errorPrefix} Value is expected to be an array`));

      if (is.regExp(specs.validate)) {
        throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
      }
      else if (is.number(specs.validate)) {
        throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
      }
      else if (is.array(specs.validate)) {
        throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
      }

      break;
    case ObjectID:
      assert(is.directInstanceOf(value, ObjectID), new TypeError(`${errorPrefix} Value is expected to be an ObjectID`));

      if (is.regExp(specs.validate)) {
        throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
      }
      else if (is.number(specs.validate)) {
        throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
      }
      else if (is.array(specs.validate)) {
        throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
      }

      break;
    default:
      // If type is an array of a type, i.e. [Number].
      if (is.array(specs.type)) {
        assert(specs.type.length === 1, new TypeError(`${errorPrefix} Field type array should only have one element`));
        assert(is.array(value), new TypeError(`${errorPrefix} Value is expected to be an array`));

        // Ensure that every element within the array conforms to the specified
        // type and passes the validation test.
        const t = value.reduce((prevVal: boolean, currVal: any) => {
          return prevVal && validate(currVal, {
            ...specs,
            type: (specs.type as SchemaFieldType[])[0],
          });
        }, true);

        assert(t, new TypeError(`${errorPrefix} One or more values within the array are not valid`));
      }
      // If type is an object.
      else if (is.object(specs.type)) {
        assert(is.object(value), new TypeError(`${errorPrefix} Value is expected to be an object`));

        if (is.regExp(specs.validate)) {
          throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
        }
        else if (is.number(specs.validate)) {
          throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
        }
        else if (is.array(specs.validate)) {
          throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
        }

        for (const subFieldName in specs.type) {
          if (!specs.type.hasOwnProperty(subFieldName)) continue;
          assert(validate(value[subFieldName], (specs.type as { [key: string]: SchemaField })[subFieldName]), new TypeError(`${errorPrefix} One or more sub-fields are not valid`));
        }
      }
    }

    if (is.function_(specs.validate)) {
      assert(specs.validate(value), new TypeError(`${errorPrefix} Failed to pass custom validation function: the value ${value} must conform to the field specs ${JSON.stringify(specs)}`));
    }

    return true;
  }
  catch (error) {
    return false;
  }
}
