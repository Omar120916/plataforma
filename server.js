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
    usuario: String,
    password: String,
    rol: String
})

const Usuario = mongoose.model('Usuario', {
    usuario: String,
    password: String,
    rol: String, // admin, maestro, alumno, padre
    alumnoId: String // para vincular papá o alumno
})

// 🔐 REGISTRO DE USUARIO
app.post('/registro', async (req, res) => {
    const { usuario, password, rol } = req.body

    const hash = await bcrypt.hash(password, 10)

    const nuevo = new Usuario({
        usuario,
        password: hash,
        rol: rol || 'maestro'
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

    const token = jwt.sign({ usuario: user.usuario, rol: user.rol }, 'secreto123')

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

// 👨‍🎓 RUTAS PROTEGIDAS
app.post('/alumnos', verificarToken, async (req, res) => {
    try {
        const nuevo = new Alumno(req.body)
        await nuevo.save()
        res.json({ mensaje: 'Alumno guardado' })
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

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('Servidor corriendo')
})