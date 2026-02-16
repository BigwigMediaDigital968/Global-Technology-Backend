const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

/* =========================
   HELPERS
========================= */

const generateOTP = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

const generateUserId = (name) => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return name.toLowerCase().replace(/\s/g, "") + random;
};

/* =========================
   REGISTER
========================= */

exports.registerUser = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password)
            return res.status(400).json({ message: "All fields required" });

        const existing = await User.findOne({ email });
        if (existing)
            return res.status(409).json({ message: "Email already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const userId = generateUserId(name);

        await User.create({
            userId,
            name,
            email,
            phone,
            password: hashedPassword,
            otp,
            otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });

        await sendEmail({
            to: email,
            subject: "OTP Verification",
            html: `<p>Your OTP is <b>${otp}</b></p>`,
        });

        res.status(201).json({
            success: true,
            message: "Registered successfully. OTP sent.",
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   VERIFY OTP
========================= */

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });
        if (!user)
            return res.status(404).json({ message: "User not found" });

        if (user.otp !== otp || user.otpExpiresAt < new Date())
            return res.status(400).json({ message: "Invalid or expired OTP" });

        // Mark verified
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpiresAt = undefined;

        await user.save();

        // Send success email
        await sendEmail({
            to: user.email,
            subject: "🎉 Registration Successful - You Can Now Login",
            text: `
                Hello ${user.name},

                Your account has been successfully verified.

                You can now login using your registered email and password.

                If you did not create this account, please contact support immediately.

                Thank you,
                Global Technology
      `,
        });

        res.json({
            success: true,
            message: "OTP verified successfully. You can now login.",
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   LOGIN
========================= */

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.isVerified)
            return res.status(400).json({ message: "Verify OTP first" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res.status(400).json({ message: "Invalid password" });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token,
            user,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   FORGOT PASSWORD
========================= */

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user)
            return res.status(404).json({ message: "User not found" });

        const resetToken = crypto.randomBytes(32).toString("hex");

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;

        await user.save();

        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        await sendEmail({
            to: email,
            subject: "Reset Password",
            html: `<a href="${resetLink}">${resetLink}</a>`,
        });

        res.json({ success: true, message: "Reset link sent to email" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   RESET PASSWORD
========================= */

exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user)
            return res.status(400).json({ message: "Invalid or expired token" });

        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   GET PROFILE
========================= */

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   UPDATE MY PROFILE
========================= */

exports.updateMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user)
            return res.status(404).json({ message: "User not found" });

        user.name = req.body.name || user.name;
        user.phone = req.body.phone || user.phone;

        if (req.body.password) {
            user.password = await bcrypt.hash(req.body.password, 10);
        }

        await user.save();

        res.json({ success: true, message: "Profile updated" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   ADMIN: GET ALL USERS
========================= */

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   ADMIN: UPDATE USER
========================= */

exports.updateUserByAdmin = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user)
            return res.status(404).json({ message: "User not found" });

        user.name = req.body.name || user.name;
        user.phone = req.body.phone || user.phone;
        user.role = req.body.role || user.role;
        user.isVerified =
            req.body.isVerified !== undefined
                ? req.body.isVerified
                : user.isVerified;

        await user.save();

        res.json({ success: true, message: "User updated by admin" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* =========================
   ADMIN: DELETE USER
========================= */

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user)
            return res.status(404).json({ message: "User not found" });

        res.json({ success: true, message: "User deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
