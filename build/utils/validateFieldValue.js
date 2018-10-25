"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const mongodb_1 = require("mongodb");
function validateFieldValue(value, specs) {
    const errorPrefix = `[validate(${value}, ${JSON.stringify(specs, null, 0)}]`;
    try {
        if (is_1.default.nullOrUndefined(value)) {
            if (specs.required) {
                throw new TypeError(`${errorPrefix} The value is required but it is undefined`);
            }
            else {
                return true;
            }
        }
        switch (specs.type) {
            case String:
                assert_1.default(is_1.default.string(value), new TypeError(`${errorPrefix} Value is expected to be a string`));
                if (is_1.default.regExp(specs.validate)) {
                    assert_1.default(specs.validate.test(value), new TypeError(`${errorPrefix} The value must conform to the regex ${specs.validate}`));
                }
                else if (is_1.default.number(specs.validate)) {
                    assert_1.default(value.length <= specs.validate, new TypeError(`${errorPrefix} The length of the value must be less than or equal to ${specs.validate}`));
                }
                else if (is_1.default.array(specs.validate)) {
                    assert_1.default(specs.validate.indexOf(value) > -1, new TypeError(`${errorPrefix} The value is not an element of ${specs.validate}`));
                }
                break;
            case Number:
                assert_1.default(is_1.default.number(value), new TypeError(`${errorPrefix} Value is expected to be a number`));
                if (is_1.default.regExp(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
                }
                else if (is_1.default.number(specs.validate)) {
                    assert_1.default(value <= specs.validate, new TypeError(`${errorPrefix} The value must be less than or equal to ${specs.validate}`));
                }
                else if (is_1.default.array(specs.validate)) {
                    assert_1.default(specs.validate.indexOf(value) > -1, new TypeError(`${errorPrefix} The value is not an element of ${specs.validate}`));
                }
                break;
            case Boolean:
                assert_1.default(is_1.default.boolean(value), new TypeError(`${errorPrefix} Value is expected to be a boolean`));
                if (is_1.default.regExp(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
                }
                else if (is_1.default.number(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
                }
                else if (is_1.default.array(specs.validate)) {
                    assert_1.default(specs.validate.indexOf(value) > -1, new TypeError(`${errorPrefix} The value is not an element of ${specs.validate}`));
                }
                break;
            case Date:
                assert_1.default(is_1.default.date(value), new TypeError(`${errorPrefix} Value is expected to be a date`));
                if (is_1.default.regExp(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
                }
                else if (is_1.default.number(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
                }
                else if (is_1.default.array(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
                }
                break;
            case Array:
                assert_1.default(is_1.default.array(value), new TypeError(`${errorPrefix} Value is expected to be an array`));
                if (is_1.default.regExp(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
                }
                else if (is_1.default.number(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
                }
                else if (is_1.default.array(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
                }
                break;
            case mongodb_1.ObjectID:
                assert_1.default(is_1.default.directInstanceOf(value, mongodb_1.ObjectID), new TypeError(`${errorPrefix} Value is expected to be an ObjectID`));
                if (is_1.default.regExp(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
                }
                else if (is_1.default.number(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
                }
                else if (is_1.default.array(specs.validate)) {
                    throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
                }
                break;
            default:
                if (is_1.default.array(specs.type)) {
                    assert_1.default(specs.type.length === 1, new TypeError(`${errorPrefix} Field type array should only have one element`));
                    assert_1.default(is_1.default.array(value), new TypeError(`${errorPrefix} Value is expected to be an array`));
                    const t = value.reduce((prevVal, currVal) => {
                        return prevVal && validateFieldValue(currVal, Object.assign({}, specs, { type: specs.type[0] }));
                    }, true);
                    assert_1.default(t, new TypeError(`${errorPrefix} One or more values within the array are not valid`));
                }
                else if (is_1.default.object(specs.type)) {
                    assert_1.default(is_1.default.object(value), new TypeError(`${errorPrefix} Value is expected to be an object`));
                    if (is_1.default.regExp(specs.validate)) {
                        throw new TypeError(`${errorPrefix} The RegExp validation method is not supported for this value type`);
                    }
                    else if (is_1.default.number(specs.validate)) {
                        throw new TypeError(`${errorPrefix} The number validation method is not supported for this value type`);
                    }
                    else if (is_1.default.array(specs.validate)) {
                        throw new TypeError(`${errorPrefix} The array validation method is not supported for this value type`);
                    }
                    for (const subFieldName in specs.type) {
                        if (!specs.type.hasOwnProperty(subFieldName))
                            continue;
                        assert_1.default(validateFieldValue(value[subFieldName], specs.type[subFieldName]), new TypeError(`${errorPrefix} One or more sub-fields are not valid`));
                    }
                }
        }
        if (is_1.default.function_(specs.validate)) {
            assert_1.default(specs.validate(value), new TypeError(`${errorPrefix} Failed to pass custom validation function: the value ${value} must conform to the field specs ${JSON.stringify(specs, null, 0)}`));
        }
        return true;
    }
    catch (error) {
        return false;
    }
}
exports.default = validateFieldValue;
//# sourceMappingURL=validateFieldValue.js.map