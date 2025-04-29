export interface NewsItem {
    id: string;
    title: string;
    source: string;
    category: string;
    content: string;
    url: string;
    publishedAt: Date;
}

export interface GeneratedContent {
    id: string;
    newsItemId: string;
    rawText: string;
    sentiment: string;
    audioUrl?: string;
    videoUrl?: string;
    imageSearchTerms: string[];
    createdAt: Date;
}

export interface AudioResult {
    path: string;
    duration: number;
    wordTimings?: { word: string; time: number; }[];
    url: string;
}

export interface AnimationState {
    eyeState: 'neutral' | 'squint' | 'wide' | 'rolling' | 'wink';
    mouthState: 'closed' | 'halfOpen' | 'open';
    headRotation: number;
    accessoryIndices: number[];
}

export interface StudioState {
    backgroundIndex: number;
    deskIndex: number;
    propIndices: number[];
    overlayText?: string;
}

export interface FrameSequence {
    directory: string;
    frames: string[];
    frameCount: number;
    frameRate: number;
    isShortFormat: boolean;
}

export interface VideoResult {
    path: string;
    duration: number;
    width: number;
    height: number;
    url: string;
    isShortFormat: boolean;
}