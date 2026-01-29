<?php
// Set session cookie parameters to 12 hours
$lifetime = 12 * 60 * 60; // 12 hours in seconds
session_set_cookie_params($lifetime);
ini_set('session.gc_maxlifetime', $lifetime);

// Start the session
session_start();

// Extend the session cookie if it already exists
if (isset($_COOKIE[session_name()])) {
    setcookie(session_name(), $_COOKIE[session_name()], time() + $lifetime, "/");
}
?>
