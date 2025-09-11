// middlewares/authMiddleware.js
import { supabasePublic } from '../config/supabaseClient.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
    }
    const token = authHeader.split(' ')[1];

    const { data, error } = await supabasePublic.auth.getUser(token);

    if (error || !data?.user) {
      console.error('Supabase getUser error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error('authenticate middleware error:', err);
    return res.status(500).json({ error: 'Server error in auth middleware' });
  }
};
