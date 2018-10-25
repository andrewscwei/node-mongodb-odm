"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
function typeIsUpdate(value) {
    if (!is_1.default.object(value))
        return false;
    return Object.keys(value).some(val => val.startsWith('$'));
}
exports.typeIsUpdate = typeIsUpdate;
//# sourceMappingURL=index.js.map