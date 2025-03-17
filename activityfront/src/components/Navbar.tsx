import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

const Navbar : React.FC = () => {
    return (
        <nav className="navbar">
            <div className="logo">magee.no</div>
            <div className="nav-sections">
                <ul className="nav-links left">
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/weather">Backend sjekk</Link></li>
                    <li><Link to="/about">About us</Link></li>
                </ul>

                <ul className="nav-links right">
                    <li><Link to="/login">Login</Link></li>
                    <li><Link to="/signup">Sign up</Link></li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;