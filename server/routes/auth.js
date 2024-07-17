require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // Import axios
const User = require('../models/User');
const router = express.Router();

// Middleware to check API key
const authenticateApiKey = (req, res, next) => {
  console.log('Incoming Headers:', req.headers); // Log all headers
  const apiKey = req.headers['x-api-key'];
  console.log('Incoming API Key:', apiKey); // Logging incoming API Key for debugging
  if (apiKey && apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden' });
  }
};

// Signup route
router.post('/signup', authenticateApiKey, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Check if user already exists by name
    let user = await User.findOne({ name });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if user already exists by email
    user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Create new user
    user = new User({ name, email, password });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save the user to the database
    await user.save();

    // Generate JWT
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Signin route
router.post('/signin', authenticateApiKey, async (req, res) => {
  const { name, password } = req.body;
  try {
    // Check if user exists
    let user = await User.findOne({ name });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Push login data to external endpoint
    try {
      const response = await axios.post('http://10.10.10.183:8081/login', {
        name,
        password,
        message: 'Login successfully' ,// Add the success message
      }, {
        headers: {
          'x-api-key': process.env.API_KEY, // Include the API key in the headers
          'Content-Type': 'application/json'
        }
      });
      console.log('External endpoint response:', response.data);
    } catch (error) {
      console.error('Error pushing login data to external endpoint:', {
        message: error.message,
        response: error.response ? error.response.data : 'No response data'
      });
    }

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
