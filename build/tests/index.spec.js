"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const is_1 = __importDefault(require("@sindresorhus/is"));
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const __1 = require("..");
mocha_1.describe('can connect to database', () => {
    mocha_1.before(() => __awaiter(this, void 0, void 0, function* () {
        __1.configureDb({
            host: 'localhost:27017',
            name: 'mongodb_odm_test',
        });
    }));
    mocha_1.it('can connect to db', () => __awaiter(this, void 0, void 0, function* () {
        yield __1.connectToDb();
        assert_1.default(__1.isDbConnected() === true);
    }));
    mocha_1.it('can disconnect', () => __awaiter(this, void 0, void 0, function* () {
        yield __1.disconnectFromDb();
        assert_1.default(__1.isDbConnected() === false);
    }));
    mocha_1.it('can fetch db instance', () => __awaiter(this, void 0, void 0, function* () {
        const db = yield __1.getDbInstance();
        assert_1.default(is_1.default.nullOrUndefined(db) === false);
    }));
});
//# sourceMappingURL=index.spec.js.map