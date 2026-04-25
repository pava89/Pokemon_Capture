const Joi = require('joi');
const { Usuario } = require('../baseDatos/index');

const validadorRegistro = Joi.object({
  cedula: Joi.string().min(8).max(10).required().messages({
      'string.base': 'La cédula debe ser un texto.',
      'string.empty': 'La cédula es obligatoria.',
      'string.min': 'La cédula debe tener al menos {#limit} caracteres.',
      'string.max': 'La cédula no puede tener más de {#limit} caracteres.',
      'any.required': 'La cédula es un campo obligatorio.'
    }),
  email: Joi.string().email().required().messages({
      'string.base': 'El email debe ser un texto.',
      'string.empty': 'El email es obligatorio.',
      'string.email': 'El email debe ser un correo electrónico válido.',
      'any.required': 'El email es un campo obligatorio.'
    }),
  nombre: Joi.string().min(2).max(50).required().messages({
      'string.base': 'El nombre debe ser un texto.',
      'string.empty': 'El nombre es obligatorio.',
      'string.min': 'El nombre debe tener al menos {#limit} caracteres.',
      'string.max': 'El nombre no puede tener más de {#limit} caracteres.',
      'any.required': 'El nombre es un campo obligatorio.'
    }),
  edad: Joi.number().integer().min(18).max(100).required().messages({
      'number.base': 'La edad debe ser un número.',
      'number.integer': 'La edad debe ser un número entero.',
      'number.min': 'La edad debe ser al menos {#limit}.',
      'number.max': 'La edad no puede ser mayor a {#limit}.',
      'any.required': 'La edad es un campo obligatorio.'
    })
});

const registrarUsuario = async (req, res) => {
  try {
    const { error } = validadorRegistro.validate(req.body, { abortEarly: false });

    if (error) {
      const mensajesErrores = error.details.map(detail => detail.message).join('|');
      return res.status(400).json(
      {
          mensaje: 'Errores en la validacion',
          resultado: {
            cedula:'',
            email:'',
            nombre:'',
            edad:'',
            erroresValidacion: mensajesErrores
          }
      });
    }

    const { cedula, email, nombre, edad} = req.body;
    
    const usuarioExistente = await Usuario.findByPk(cedula);
    
    if (usuarioExistente) {
      return res.status(400).json({ mensaje: 'El usuario ya existe',resultado:null });
    }
   // el await es para hacer una colaa de espera
    const nuevoUsuario = await Usuario.create({ cedula, email, nombre, edad });
    res.status(201).json(
      { 
        mensaje:'Usuario creado',
        resultado: {
          cedula:nuevoUsuario.cedula,
          email:nuevoUsuario.email,
          nombre:nuevoUsuario.nombre,
          edad:nuevoUsuario.edad,
          erroresValidacion: ''
        }
    });
  } catch (error) {
    res.status(400).json({ mensaje: error.message,resultado:null});
  }
};

const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll();
    res.status(200).json({ mensaje: 'Usuarios listados', resultado: usuarios });
  } catch (error) {
    res.status(500).json({ mensaje: error.message, resultado: null });
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { cedula } = req.params;
    const { email, nombre, edad } = req.body;
    const usuario = await Usuario.findByPk(cedula);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado', resultado: null });
    }
    
    const nuevoUsuario = await Usuario.update({ email, nombre, edad });
    res.status(200).json({ mensaje: 'Usuario actualizado', resultado: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ mensaje: error.message, resultado: null });
  }
};

const borrarUsuario = async (req, res) => {
  try {
    const { cedula } = req.params;
    const usuario = await Usuario.findByPk(cedula);
    
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado', resultado: null });
    }
    
    const borrarUsuario = await Usuario.destroy();
    res.status(200).json({ mensaje: 'Usuario eliminado', resultado: borrarUsuario });
  } catch (error) {
    res.status(500).json({ mensaje: error.message, resultado: null });
  }
};

module.exports = {
    registrarUsuario,
    listarUsuarios,
    actualizarUsuario,
    borrarUsuario
};