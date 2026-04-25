const definePokemonCapturado = (sequelize, DataTypes) => {
  return sequelize.define('PokemonCapturado', {
      id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
      },
      pokemonId: {
          type: DataTypes.INTEGER,
          references: {
              model: 'pokemon',
              key: 'id'
          }
      },
      usuarioCedula: {
          type: DataTypes.STRING,
          references: {
              model: 'usuario',
              key: 'cedula'
          }
      }
  }, {
      tableName: 'pokemoncapturado',
      timestamps: true,
  });
};

module.exports = definePokemonCapturado;
