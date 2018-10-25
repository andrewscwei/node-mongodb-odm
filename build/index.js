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
const debug_1 = __importDefault(require("debug"));
const mongodb_1 = require("mongodb");
const log = debug_1.default('mongodb-odm');
let client;
let options;
process.on('SIGINT', () => __awaiter(this, void 0, void 0, function* () {
    if (client) {
        yield disconnect();
        log('MongoDB client disconnected due to app termination');
    }
    process.exit(0);
}));
function configure(descriptor) {
    options = descriptor;
}
exports.configure = configure;
function connect() {
    return __awaiter(this, void 0, void 0, function* () {
        if (client && client.isConnected)
            return;
        if (!options)
            throw new Error('You must configure connection options by calling #configure()');
        const authentication = (options.username && options.password) ? `${options.username}:${options.password}` : undefined;
        const url = `mongodb://${authentication ? `${authentication}@` : ''}${options.host}/${options.name}`;
        client = yield mongodb_1.MongoClient.connect(url, {
            useNewUrlParser: true,
        });
        const connection = client.db(options.name);
        log('MongoDB client is open:', url);
        connection.on('authenticated', () => {
            log('MongoDB servers authenticated');
        });
        connection.on('close', (err) => {
            log('MongoDB client closed because:', err);
        });
        connection.on('error', (err) => {
            log('MongoDB client error:', err);
        });
        connection.on('fullsetup', () => {
            log('MongoDB full setup complete');
        });
        connection.on('parseError', (err) => {
            log('MongoDB parse error:', err);
        });
        connection.on('reconnect', () => {
            log('MongoDB reconnected');
        });
        connection.on('timeout', (err) => {
            log('MongoDB client timed out:', err);
        });
    });
}
exports.connect = connect;
function disconnect() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!client)
            return;
        yield client.close();
    });
}
exports.disconnect = disconnect;
function isConnected() {
    if (!client)
        return false;
    if (!client.isConnected)
        return false;
    return true;
}
exports.isConnected = isConnected;
function getInstance() {
    return __awaiter(this, void 0, void 0, function* () {
        if (client)
            return client.db(options.name);
        log('There is no MongoDB client, establishing one now...');
        yield connect();
        return getInstance();
    });
}
exports.getInstance = getInstance;
function getModel(modelOrCollectionName) {
    const models = options.models;
    if (models) {
        if (models.hasOwnProperty(modelOrCollectionName))
            return models[modelOrCollectionName];
        for (const key in models) {
            if (!models.hasOwnProperty(key))
                continue;
            const ModelClass = models[key];
            if (ModelClass.schema.collection === modelOrCollectionName)
                return ModelClass;
        }
    }
    throw new Error(`No model found for model/collection name ${modelOrCollectionName}`);
}
exports.getModel = getModel;
//# sourceMappingURL=index.js.map