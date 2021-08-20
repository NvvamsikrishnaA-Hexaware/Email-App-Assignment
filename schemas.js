const Joi = require('@hapi/joi')
const schemas = {
    createUser: Joi.object().keys({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),
    loginSchema: Joi.object().keys({
        email: Joi.string().required(),
        password: Joi.string().required()
    }),
    emailSchema: Joi.object().keys({
        to: Joi.array().items(Joi.string().email()).required(),
        cc: Joi.array().items(Joi.string().email()),
        bcc: Joi.array().items(Joi.string().email()),
        subject: Joi.string().required(),
        description: Joi.string().required()
    })
};
module.exports = schemas;