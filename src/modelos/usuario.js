const defineUsuario = (sequelize, DataTypes) => {
    return sequelize.define('Usuario', {
        cedula: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
            unique: 'cedula'
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: 'email'
        },
        nombre: {
            type: DataTypes.STRING,
            allowNull: false
        },
        edad: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'usuario',
        timestamps: true
    });
};

module.exports = defineUsuario;