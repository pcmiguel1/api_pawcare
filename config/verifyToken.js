const jwt = require('jsonwebtoken');

module.exports = {

    adminAuthenticateToken: function(req, res, next) {
        const authHeader = req.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1]
        if (token == null) return res.sendStatus(401)

        jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
            var role = user.role
            if (err) return res.sendStatus(403)
            if (role) return res.sendStatus(403)
            req.userId = user
            next();
        })

    },
    authenticateToken: function(req, res, next) {
        const authHeader = req.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1]
        if (token == null) return res.sendStatus(401)

        jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return res.sendStatus(401); // Token expired
                } else {
                    return res.sendStatus(403); // Invalid token
                }
            }
            req.userId = user._id
            next();
        })

    },

}