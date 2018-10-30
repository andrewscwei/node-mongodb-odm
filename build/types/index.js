"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const mongodb_1 = require("mongodb");
/**
 * Checks if a value is an Update.
 *
 * @param value - Value to check.
 *
 * @return `true` if value is an Update, `false` otherwise.
 */
function typeIsUpdate(value) {
    if (!is_1.default.plainObject(value))
        return false;
    return Object.keys(value).some(val => val.startsWith('$'));
}
exports.typeIsUpdate = typeIsUpdate;
/**
 * Checks if a value is an identifiable Document.
 *
 * @param value - Value to check.
 *
 * @return `true` if value is an identifiable Document, `false` otherwise.
 */
function typeIsIdentifiableDocument(value) {
    if (is_1.default.nullOrUndefined(value))
        return false;
    if (!is_1.default.plainObject(value))
        return false;
    if (!typeIsObjectID(value._id))
        return false;
    return true;
}
exports.typeIsIdentifiableDocument = typeIsIdentifiableDocument;
/**
 * Checks if a value is an ObjectID.
 *
 * @param value - Value to check.
 *
 * @return `true` if valie is an ObjectID, `false` otherwise.
 */
function typeIsObjectID(value) {
    if (!is_1.default.directInstanceOf(value, mongodb_1.ObjectID))
        return false;
    return true;
}
exports.typeIsObjectID = typeIsObjectID;
/**
 * Checks if a value is a GeoCoordinate. Also ensures the longitude and latitude
 * ranges, throws if out of range for either value.
 *
 * @param value - Value to check.
 *
 * @return `true` if value is a GeoCoordinate, `false` otherwise.
 */
function typeIsGeoCoordinate(value) {
    if (!is_1.default.array(value))
        return false;
    if (value.length !== 2)
        return false;
    if (!is_1.default.number(value[0]))
        return false;
    if (!is_1.default.number(value[1]))
        return false;
    const [longitude, latitude] = value;
    if (longitude < -180)
        throw new Error('Longitude value must not be less than -180 degrees');
    if (longitude > 180)
        throw new Error('Longitude value must not be greater than 180 degrees');
    if (latitude < -90)
        throw new Error('Longitude value must not be less than -90 degrees');
    if (latitude > 90)
        throw new Error('Longitude value must not be greater than 90 degrees');
    return true;
}
exports.typeIsGeoCoordinate = typeIsGeoCoordinate;
//# sourceMappingURL=index.js.map