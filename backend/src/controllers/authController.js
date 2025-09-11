
import { supabasePublic, supabaseAdmin } from '../config/supabaseClient.js';

export const signup = async (req, res) => {
  const { email, password, full_name } = req.body;

  try {
    const { data: userData, error: signUpError } = await supabasePublic.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message });
    }

    const newUser = userData.user;

    // Insert profile using admin client (bypasses RLS)
    const { error: insertError } = await supabaseAdmin.from('user_profiles').insert({
      id: newUser.id,
      role: 'user',
      full_name,
    });

    if (insertError) {
      console.error('Error inserting user profile:', insertError);
      return res.status(500).json({ error: 'Failed to create user profile.' });
    }

    return res.status(200).json({
      message: 'A confirmation email has been sent. Please check your inbox to verify your account.',
      user: newUser,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Server error during signup.' });
  }
};


export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { data: profile, error: profileError } = await supabasePublic
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile.' });
    }

    return res.json({
      message: 'Login successful',
      session: data.session,
      profile: profile,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};