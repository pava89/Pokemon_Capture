const { Pokemon } = require('../baseDatos');

const registrarPokemon = async (req, res) => {
  try {
    const { nombre, tipo, poder } = req.body;
    
    const pokemonExistente = await Pokemon.findOne({
        where: {
            nombre: nombre
        }
    });

    if (pokemonExistente) {
      return res.status(400).json({ mensaje: "El pokemon ya existe", resultado: null });
    }

    const nuevoPokemon = await Pokemon.create({ nombre, tipo, poder });
    res.status(201).json({ mensaje: "Pokemon creado", resultado: nuevoPokemon });
  } catch (error) {
    res.status(400).json({ mensaje: error.message, resultado: null });
  }
};

const listarPokemones = async (req, res) => {
  try {
    const pokemones = await Pokemon.findAll();
    res.status(200).json({ mensaje: "Lista de Pokémon", resultado: pokemones });
  } catch (error) {
    res.status(400).json({ mensaje: error.message, resultado: null });
  }
};

module.exports = {
    registrarPokemon,
    listarPokemones
};