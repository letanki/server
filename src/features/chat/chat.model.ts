import mongoose, { Schema, model, Document } from "mongoose";

export interface IChatMessage extends Document {
    sourceUser: mongoose.Types.ObjectId | null;
    targetUser: mongoose.Types.ObjectId | null;
    message: string;
    isSystemMessage: boolean;
    isWarning: boolean;
    timestamp: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
    sourceUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    targetUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    message: {
        type: String,
        required: true,
    },
    isSystemMessage: {
        type: Boolean,
        default: false,
    },
    isWarning: {
        type: Boolean,
        default: false,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true, // usado no sort/skip do corte de histórico (mantém só as N mais recentes)
    },
});

const ChatMessage = model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;