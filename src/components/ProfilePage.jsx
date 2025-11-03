// src/components/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ProfilePage({ user, onBack }) {
    const [following, setFollowing] = useState([]);
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                // Fetch everyone this user follows
                const { data: followingData, error: followErr } = await supabase
                    .from("user_follows")
                    .select("followee_id")
                    .eq("follower_id", user.id);
                if (followErr) throw followErr;

                const followees = followingData.map((f) => f.followee_id);

                // Fetch everyone who follows the current user
                const { data: followersData, error: followersErr } = await supabase
                    .from("user_follows")
                    .select("follower_id")
                    .eq("followee_id", user.id);
                if (followersErr) throw followersErr;

                const followers = followersData.map((f) => f.follower_id);

                // Compute mutual follows = friends
                const mutualIds = followees.filter((id) => followers.includes(id));

                // Fetch profile info (email) for all users involved
                const { data: allUsers, error: usersErr } = await supabase
                    .from("user_positions")
                    .select("user_id,email")
                    .in("user_id", [...new Set([...followees, ...mutualIds])]);
                if (usersErr) throw usersErr;

                setFollowing(
                    allUsers.filter((u) => followees.includes(u.user_id))
                );
                setFriends(
                    allUsers.filter((u) => mutualIds.includes(u.user_id))
                );
            } catch (e) {
                console.error("Profile load error", e);
            } finally {
                setLoading(false);
            }
        })();
    }, [user]);

    if (loading)
        return (
            <div className="flex items-center justify-center h-full text-white">
                Loading profile...
            </div>
        );

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/30">
                <h1 className="text-2xl font-bold">🌠 {user.email.split("@")[0]}'s Profile</h1>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-lg font-semibold"
                >
                    ⬅ Back to Sky
                </button>

            </div>

            {/* Following List */}
            <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-black/50 p-4 rounded-2xl border border-white/10">
                    <h2 className="text-lg font-semibold mb-2">👣 Following</h2>
                    {following.length === 0 ? (
                        <div className="text-gray-400 text-sm">You’re not following anyone yet.</div>
                    ) : (
                        <ul className="space-y-1">
                            {following.map((f) => (
                                <li
                                    key={f.user_id}
                                    className="bg-white/10 p-2 rounded text-sm"
                                >
                                    {f.email}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Friends */}
                <div className="bg-black/50 p-4 rounded-2xl border border-white/10">
                    <h2 className="text-lg font-semibold mb-2">💫 Friends</h2>
                    {friends.length === 0 ? (
                        <div className="text-gray-400 text-sm">No mutual friends yet.</div>
                    ) : (
                        <ul className="space-y-1">
                            {friends.map((f) => (
                                <li
                                    key={f.user_id}
                                    className="bg-white/10 p-2 rounded text-sm"
                                >
                                    {f.email}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
