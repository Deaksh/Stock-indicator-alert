import React, { useState } from "react";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

import { IconButton, Menu, MenuItem, Avatar, Tooltip } from "@mui/material";

export default function UserMenu({ user }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    signOut(auth);
    handleClose();
  };

  return (
    <>
      <Tooltip title={user?.email || "User"}>
        <IconButton onClick={handleClick} size="small" sx={{ ml: 2 }}>
          <Avatar alt={user?.email || "U"}>
            {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 4,
          sx: { mt: 1.5, minWidth: 140 },
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem disabled>{user?.email}</MenuItem>
        <MenuItem onClick={handleLogout}>Logout</MenuItem>
      </Menu>
    </>
  );
}
