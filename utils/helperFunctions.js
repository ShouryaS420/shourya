import pkg from 'uuid';
const { v4: uuidv4 } = pkg;

// Function to generate a random OTP
export const generateOtp = () => {
    return Math.floor(1000 + Math.random() * 9000).toString(); // 6-digit OTP
};

// Function to generate a mock authentication token (replace with JWT in production)
export const generateAuthToken = () => {
    return uuidv4(); // Generate a unique token for user session
};
