const express = require ('express');
const pool  = require('../config/db');

const router = express.Router();

router.post("/", async (req, res) => {
    const { name, email } = req.body; // new request

    const [result] = await pool.query(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        [name, email]
    );

    res.status(201).json({
        message: "User created successfully",
        userId: result.insertId
    });
});
router.get('/:id',async(req,res)=>{
    const {id} = req.params;// get parameters present their
    const [rows] = await pool.query(`SELECT * FROM users WHERE id = ${id}`);
    if(rows.length === 0){
        return res.status(404).json({
            message: 'Users not found'
        });
    }
    res.json(rows[0]);
});


module.exports = router;