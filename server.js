const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()

app.use(express.json())
app.use(express.static('public'))

// 🔥 CONEXIÓN A MONGO
mongoose.connect('mongodb+srv://admin:120916@cluster0.uztomh4.mongodb.net/escuela')
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.log(err))

// 🔥 MODELOS
const Usuario = mongoose.model('Usuario', {
    nombre: String, // 👈 NUEVO
    usuario: String,
    password: String,
    rol: String,
    alumnoId: String
})

const Alumno = mongoose.model('Alumno', {
    nombre: String,
    edad: String,
    maestro: String, // ID DEL MAESTRO
    tutor: String // nombre del papá (opcional)
})

// 🔐 REGISTRO DE USUARIO
app.post('/registro', verificarToken, soloAdmin, async (req, res) => {
    const { nombre, usuario, password, rol, alumnoId } = req.body

    const hash = await bcrypt.hash(password, 10)

    const nuevo = new Usuario({
        nombre,
        usuario,
        password: hash,
        rol,
        alumnoId
    })

    await nuevo.save()

    res.json({ mensaje: 'Usuario creado' })
})

// 🔐 LOGIN REAL
app.post('/login', async (req, res) => {
    const { usuario, password } = req.body

    const user = await Usuario.findOne({ usuario })

    if (!user) {
        return res.status(401).json({ mensaje: 'Usuario no existe' })
    }

    const valido = await bcrypt.compare(password, user.password)

    if (!valido) {
        return res.status(401).json({ mensaje: 'Contraseña incorrecta' })
    }

    const token = jwt.sign({usuario: user.usuario, rol: user.rol,alumnoId: user.alumnoId}, 'secreto123')
    res.json({ token })
})

// 🛡️ MIDDLEWARE
function verificarToken(req, res, next) {
    const token = req.headers['authorization']

    if (!token) return res.status(403).json({ mensaje: 'No autorizado' })

    try {
        const decoded = jwt.verify(token, 'secreto123')
        req.usuario = decoded
        next()
    } catch {
        res.status(401).json({ mensaje: 'Token inválido' })
    }
}

function soloAdmin(req, res, next) {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'Solo admin puede hacer esto' })
    }
    next()
}

// 👨‍🎓 RUTAS PROTEGIDAS
app.post('/alumnos', verificarToken, async (req, res) => {
    try {
        const nuevo = new Alumno(req.body)
        await nuevo.save()
        res.json(nuevo) // 👈 esto es clave
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar' })
    }
})

app.get('/alumnos', verificarToken, async (req, res) => {
    try {
        const alumnos = await Alumno.find()
        res.json(alumnos)
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener alumnos' })
    }
})

app.get('/usuarios', verificarToken, async (req, res) => {
    try {
        const usuarios = await Usuario.find()
        res.json(usuarios)
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' })
    }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('Servidor corriendo')
})