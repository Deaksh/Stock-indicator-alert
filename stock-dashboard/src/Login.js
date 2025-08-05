import React, { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Paper, Typography, TextField, Button, Box, Alert } from "@mui/material";

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (onSuccess) onSuccess();
    } catch (error) {
      setErr(error.message || "Login failed");
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{ maxWidth: 400, margin: "50px auto", p: 4, borderRadius: 3 }}
      component="form"
      onSubmit={handleLogin}
      autoComplete="off"
    >
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, color: "#3557d5" }}>
        Sign In
      </Typography>

      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        fullWidth
        margin="normal"
        autoComplete="new-email"
      />

      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        fullWidth
        margin="normal"
        autoComplete="new-password"
      />

      <Box mt={3}>
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ bgcolor: "#3557d5", fontWeight: "bold", fontSize: 16 }}
        >
          Log In
        </Button>
      </Box>

      {err && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {err}
        </Alert>
      )}
    </Paper>
  );
}
