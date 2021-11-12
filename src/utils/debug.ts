export default process.env.NODE_ENV === 'development' ? require('debug')(`mongodb-odm:model`) : () => {}

