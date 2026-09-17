const { logAudit } = require('../services/auditService');
const User = require("../models/user");
const PendingRegistration = require("../models/PendingRegistration");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { authConfig, getCookieMaxAge, isProduction } = require("../config/authConfig");
const emailService = require("../services/emailService");

// Helper function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.register = async (req, res) => {
    console.log("Register: processing");
    try {
        const { name, email, password, role, phoneNumber } = req.body;
        const normalizedEmail = email ? email.toLowerCase().trim() : "";
        console.log(`Register: ${normalizedEmail}, role: ${role || "user"}`);

        if (!name || !normalizedEmail || !password) {
            console.log("Register: missing fields");
            return res.status(400).json({ message: "All fields are required" });
        }

        console.log("Register: checking user");
        const userExist = await User.findOne({ email: normalizedEmail });
        if (userExist) {
            console.log(`Register: ${normalizedEmail} exists`);
            return res.status(400).json({ message: "User already exists with this email" });
        }

        console.log("Register: hashing");
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP for email verification
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        console.log("Register: storing pending registration (data will be saved to main DB only after email verification)");
        await PendingRegistration.findOneAndUpdate(
            { email: normalizedEmail },
            {
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: role || "user",
                phoneNumber: phoneNumber ? String(phoneNumber).trim() : undefined,
                emailVerificationOTP: otp,
                emailVerificationOTPExpiry: otpExpiry,
                createdAt: new Date(),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Send verification email with a safety timeout race so client never hangs
        try {
            const emailPromise = emailService.sendEmailVerificationOTP(normalizedEmail, otp, name.trim());
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Verification email dispatch took longer than 6s")), 6000)
            );
            await Promise.race([emailPromise, timeoutPromise]);
            console.log(`Verification email sent to: ${normalizedEmail}`);
        } catch (emailError) {
            console.warn("Notice: Verification email dispatch warning (account pending created successfully):", emailError.message || emailError);
            // Non-blocking: Account registration is already secured in PendingRegistration!
            // User will be prompted on /verify-email where they can enter the code or click resend.
        }

        res.status(201).json({
            message: "Verification code sent to your email. Please verify to complete registration.", 
            requiresVerification: true,
            email: normalizedEmail
        });
    } catch (error) {
        console.error("Register error:", error.message);
        res.status(500).json({
            message: "Internal server error", error: error.message
        });
    }
};

exports.login = async (req, res) => {
    console.log("Login: processing");
    try {
        const { email, password } = req.body;
        const normalizedEmail = email ? email.toLowerCase().trim() : "";
        console.log(`Login: ${normalizedEmail}`);
        
        if (!normalizedEmail || !password) {
            console.log("Login: missing fields");
            return res.status(400).json({ message: "All fields are required" });
        }

        console.log("Login: finding user");
        const user = await User.findOne({ email: normalizedEmail }).select("+password");
        if (!user){
            // Check if there is a pending registration waiting for email verification
            const pending = await PendingRegistration.findOne({ email: normalizedEmail });
            if (pending) {
                const isMatch = await bcrypt.compare(password, pending.password);
                if (isMatch) {
                    return res.status(403).json({ 
                        message: "Please verify your email before logging in", 
                        requiresVerification: true,
                        email: pending.email
                    });
                }
            }
            console.log(`Login: ${normalizedEmail} not found`);
            return res.status(400).json({ message: "User not found" });
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            console.log(`Login: ${normalizedEmail} email not verified`);
            return res.status(403).json({ 
                message: "Please verify your email before logging in", 
                requiresVerification: true,
                userId: user._id,
                email: user.email
            });
        }
        
        console.log("Login: checking password");
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Login: invalid password for ${email}`);
            return res.status(401).json({ message: "Invalid credentials" });
        }

        console.log("Login: generating token");
        const token = jwt.sign({ userId: user._id, role: user.role }, authConfig.jwtSecret, {
            expiresIn: authConfig.jwtExpiresIn,
        });
        
        console.log(`Login: success ${email}, role: ${user.role}, expires: ${authConfig.jwtExpiresIn}`);
        res.cookie("token", token, {
            httpOnly: true,
            secure: isProduction(),
            sameSite: "strict",
            maxAge: getCookieMaxAge(),
        });

        // -- AUDIT LOG --
        try {
            await logAudit({
                req: { ...req, user: user }, // Provide context since req.user isn't set yet during login
                action: "LOGIN",
                resourceEntity: "User",
                resourceId: user._id,
                changes: { action: "Successful login" }
            });
        } catch (auditError) {
            console.error("Failed to log login action:", auditError);
        }

        res.status(200).json({
            token, user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                employeeId: user.employeeId,
                department: user.department,
                position: user.position,
                permissions: user.permissions || {},
                assignedJobs: user.assignedJobs || []
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({
            error: "Server error"
        });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                employeeId: user.employeeId,
                department: user.department,
                position: user.position,
                permissions: user.permissions || {},
                assignedJobs: user.assignedJobs || []
            }
        });
    } catch (error) {
        console.error("GetMe error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

exports.verifyEmail = async (req, res) => {
    console.log("VerifyEmail: processing");
    try {
        const { email, otp } = req.body;
        const normalizedEmail = email ? email.toLowerCase().trim() : "";
        const cleanOtp = otp ? String(otp).trim() : "";
        console.log(`VerifyEmail: ${normalizedEmail} with OTP: ${cleanOtp}`);

        if (!normalizedEmail || !cleanOtp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        // 1. Check pending registrations (user data saved to main DB only after verification)
        const pending = await PendingRegistration.findOne({ email: normalizedEmail });

        if (pending) {
            if (pending.emailVerificationOTP !== cleanOtp) {
                return res.status(400).json({ message: "Invalid OTP" });
            }

            if (new Date() > pending.emailVerificationOTPExpiry) {
                return res.status(400).json({ message: "OTP has expired. Please request a new one." });
            }

            // OTP valid -> CREATE USER IN MAIN DATABASE NOW!
            const newUser = await User.create({
                name: pending.name,
                email: pending.email,
                password: pending.password, // already hashed with bcrypt
                phoneNumber: pending.phoneNumber,
                role: pending.role || "user",
                status: "active",
                isEmailVerified: true,
            });

            // Remove pending registration record
            await PendingRegistration.deleteOne({ _id: pending._id });

            console.log(`Email verified and user saved to DB: ${newUser.email} (${newUser._id})`);

            // Audit log creation
            try {
                await logAudit({
                    req: { ...req, user: newUser },
                    action: "CREATE",
                    resourceEntity: "User",
                    resourceId: newUser._id,
                    changes: {
                        newData: { name: newUser.name, email: newUser.email, role: newUser.role }
                    }
                });
            } catch (auditError) {
                console.error("Failed to log audit (verifyEmail):", auditError);
            }

            // Send welcome email in background
            try {
                await emailService.sendWelcomeEmail({ name: newUser.name, email: newUser.email });
            } catch (welcomeError) {
                console.error("Failed to send welcome email:", welcomeError.message || welcomeError);
            }

            return res.status(200).json({
                message: "Email verified and account created successfully",
                user: {
                    id: newUser._id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role
                }
            });
        }

        // 2. Legacy fallback for existing users registered prior to pending registration optimization
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: "No registration found for this email. Please register again." });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: "Email already verified. Please sign in." });
        }

        if (!user.emailVerificationOTP || user.emailVerificationOTP !== cleanOtp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        if (new Date() > user.emailVerificationOTPExpiry) {
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }

        user.isEmailVerified = true;
        user.emailVerificationOTP = null;
        user.emailVerificationOTPExpiry = null;
        await user.save();

        console.log(`Legacy user email verified: ${normalizedEmail}`);
        return res.status(200).json({ message: "Email verified successfully" });
    } catch (error) {
        console.error("VerifyEmail error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.resendVerificationOTP = async (req, res) => {
    console.log("ResendVerificationOTP: processing");
    try {
        const { email } = req.body;
        const normalizedEmail = email ? email.toLowerCase().trim() : "";
        console.log(`ResendVerificationOTP: ${normalizedEmail}`);

        if (!normalizedEmail) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Check if user is already verified in DB
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser && existingUser.isEmailVerified) {
            return res.status(400).json({ message: "Email is already verified. Please sign in." });
        }

        // Check pending registration
        const pending = await PendingRegistration.findOne({ email: normalizedEmail });
        let recipientName = "User";

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        if (pending) {
            recipientName = pending.name || "User";
            pending.emailVerificationOTP = otp;
            pending.emailVerificationOTPExpiry = otpExpiry;
            await pending.save();
        } else if (existingUser && !existingUser.isEmailVerified) {
            // Legacy unverified user
            recipientName = existingUser.name || "User";
            existingUser.emailVerificationOTP = otp;
            existingUser.emailVerificationOTPExpiry = otpExpiry;
            await existingUser.save();
        } else {
            return res.status(404).json({ message: "No registration found for this email. Please register again." });
        }

        // Send verification email
        try {
            await emailService.sendEmailVerificationOTP(normalizedEmail, otp, recipientName);
            console.log(`Verification email resent to: ${normalizedEmail}`);
            return res.status(200).json({ message: "Verification OTP sent successfully" });
        } catch (emailError) {
            console.error("Failed to send verification email:", emailError.message || emailError);
            if (process.env.NODE_ENV !== "production") {
                return res.status(200).json({
                    message: `Email sending failed (${emailError.message || "SMTP error"}). Dev OTP: ${otp}`,
                    devOtp: otp
                });
            }
            return res.status(500).json({ 
                message: emailError.message || "Failed to send verification email. Please check email credentials." 
            });
        }
    } catch (error) {
        console.error("ResendVerificationOTP error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.forgotPassword = async (req, res) => {
    console.log("ForgotPassword: processing");
    try {
        const { email } = req.body;
        console.log(`ForgotPassword: ${email}`);

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found with this email" });
        }

        // Generate OTP for password reset
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.passwordResetOTP = otp;
        user.passwordResetOTPExpiry = otpExpiry;
        await user.save();

        // Send password reset email
        try {
            await emailService.sendPasswordResetOTP(email, otp, user.name);
            console.log(`Password reset email sent to: ${email}`);
            return res.status(200).json({ message: "Password reset OTP sent to your email" });
        } catch (emailError) {
            console.error("Failed to send password reset email:", emailError.message || emailError);
            if (process.env.NODE_ENV !== "production") {
                return res.status(200).json({
                    message: `Email sending failed (${emailError.message || "SMTP error"}). Dev OTP: ${otp}`,
                    devOtp: otp
                });
            }
            return res.status(500).json({ 
                message: emailError.message || "Failed to send password reset email. Please check email credentials." 
            });
        }
    } catch (error) {
        console.error("ForgotPassword error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.resetPassword = async (req, res) => {
    console.log("ResetPassword: processing");
    try {
        const { email, otp, newPassword } = req.body;
        console.log(`ResetPassword: ${email} with OTP: ${otp}`);

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: "Email, OTP, and new password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.passwordResetOTP || user.passwordResetOTP !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        if (new Date() > user.passwordResetOTPExpiry) {
            return res.status(400).json({ message: "OTP has expired" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear OTP
        user.password = hashedPassword;
        user.passwordResetOTP = null;
        user.passwordResetOTPExpiry = null;
        await user.save();

        console.log(`Password reset successful for: ${email}`);
        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("ResetPassword error:", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getAllUsers = async (req, res) => {
    console.log("GetAllUsers: fetching");
    try {
        const users = await User.find().select("_id name email");
        console.log(`GetAllUsers: found ${users.length}`);
        res.status(200).json(users);
    } catch (err) {
        console.error("GetAllUsers error:", err.message);
        res.status(500).json({ message: "Server error" });
    }
};
