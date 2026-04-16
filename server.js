const express = require('express')
const mongoose = require('mongoose')
const app = express()

app.use(express.json())
app.use(express.static('public'))

// 🔥 CONEXIÓN A MONGODB (AQUÍ PEGA TU LINK)
mongoose.connect('mongodb+srv://carlossanchez1359_db_user:a0L5NtKO6Aw2QQds@cluster0.uztomh4.mongodb.net/escuela')
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.log(err))

// 🔥 MODELO
const Alumno = mongoose.model('Alumno', {
    nombre: String,
    edad: String
})

// LOGIN (simple)
app.post('/login', (req, res) => {
    const { usuario, password } = req.body

    if (usuario === 'admin' && password === '1234') {
        res.json({ mensaje: 'Login correcto' })
    } else {
        res.status(401).json({ mensaje: 'Datos incorrectos' })
    }
})

// REGISTRAR ALUMNO (GUARDA EN MONGO)
app.post('/alumnos', async (req, res) => {
    const nuevo = new Alumno(req.body)
    await nuevo.save()
    res.json({ mensaje: 'Alumno guardado' })
})

// OBTENER ALUMNOS (DESDE MONGO)
app.get('/alumnos', async (req, res) => {
    const alumnos = await Alumno.find()
    res.json(alumnos)
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('Servidor corriendo')
})