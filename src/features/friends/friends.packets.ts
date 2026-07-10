import { packetClass } from "@/packets/packet-class";
import { defs } from "protanki-protocol";

// IDs e schemas em `protanki-protocol` (defs.friends.*).

export const AcceptFriendRequest = packetClass(defs.friends.AcceptFriendRequest);
export type AcceptFriendRequest = InstanceType<typeof AcceptFriendRequest>;

export const AcknowledgeNewFriend = packetClass(defs.friends.AcknowledgeNewFriend);
export type AcknowledgeNewFriend = InstanceType<typeof AcknowledgeNewFriend>;

export const AcknowledgeNewFriendRequest = packetClass(defs.friends.AcknowledgeNewFriendRequest);
export type AcknowledgeNewFriendRequest = InstanceType<typeof AcknowledgeNewFriendRequest>;

export const AlreadyFriends = packetClass(defs.friends.AlreadyFriends);
export type AlreadyFriends = InstanceType<typeof AlreadyFriends>;

export const CancelFriendRequest = packetClass(defs.friends.CancelFriendRequest);
export type CancelFriendRequest = InstanceType<typeof CancelFriendRequest>;

export const CheckUserExistsForFriend = packetClass(defs.friends.CheckUserExistsForFriend);
export type CheckUserExistsForFriend = InstanceType<typeof CheckUserExistsForFriend>;

export const DeclineAllFriendRequests = packetClass(defs.friends.DeclineAllFriendRequests);
export type DeclineAllFriendRequests = InstanceType<typeof DeclineAllFriendRequests>;

export const DeclineFriendRequest = packetClass(defs.friends.DeclineFriendRequest);
export type DeclineFriendRequest = InstanceType<typeof DeclineFriendRequest>;

export const FriendRemoved = packetClass(defs.friends.FriendRemoved);
export type FriendRemoved = InstanceType<typeof FriendRemoved>;

export const FriendRequestAccepted = packetClass(defs.friends.FriendRequestAccepted);
export type FriendRequestAccepted = InstanceType<typeof FriendRequestAccepted>;

export const FriendRequestAlreadySent = packetClass(defs.friends.FriendRequestAlreadySent);
export type FriendRequestAlreadySent = InstanceType<typeof FriendRequestAlreadySent>;

export const FriendRequestCanceledOrDeclined = packetClass(defs.friends.FriendRequestCanceledOrDeclined);
export type FriendRequestCanceledOrDeclined = InstanceType<typeof FriendRequestCanceledOrDeclined>;

export const FriendRequestDeclined = packetClass(defs.friends.FriendRequestDeclined);
export type FriendRequestDeclined = InstanceType<typeof FriendRequestDeclined>;

export const FriendRequestSent = packetClass(defs.friends.FriendRequestSent);
export type FriendRequestSent = InstanceType<typeof FriendRequestSent>;

export const FriendsList = packetClass(defs.friends.FriendsList);
export type FriendsList = InstanceType<typeof FriendsList>;

export const IncomingFriendRequestExists = packetClass(defs.friends.IncomingFriendRequestExists);
export type IncomingFriendRequestExists = InstanceType<typeof IncomingFriendRequestExists>;

export const LoadFriends = packetClass(defs.friends.LoadFriends);
export type LoadFriends = InstanceType<typeof LoadFriends>;

export const NewFriendRequest = packetClass(defs.friends.NewFriendRequest);
export type NewFriendRequest = InstanceType<typeof NewFriendRequest>;

export const RemoveFriend = packetClass(defs.friends.RemoveFriend);
export type RemoveFriend = InstanceType<typeof RemoveFriend>;

export const UserExistsForFriend = packetClass(defs.friends.UserExistsForFriend);
export type UserExistsForFriend = InstanceType<typeof UserExistsForFriend>;

export const UserInvalidForFriend = packetClass(defs.friends.UserInvalidForFriend);
export type UserInvalidForFriend = InstanceType<typeof UserInvalidForFriend>;

export const SendFriendRequest = packetClass(defs.friends.SendFriendRequest);
export type SendFriendRequest = InstanceType<typeof SendFriendRequest>;

export const RequestFriendsListWindow = packetClass(defs.friends.RequestFriendsListWindow);
export type RequestFriendsListWindow = InstanceType<typeof RequestFriendsListWindow>;

export const ShowFriendsListWindow = packetClass(defs.friends.ShowFriendsListWindow);
export type ShowFriendsListWindow = InstanceType<typeof ShowFriendsListWindow>;
