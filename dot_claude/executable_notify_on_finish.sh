#!/bin/bash
# Make this executable with: chmod +x ~/.claude/notify_on_finish.sh

# Read the JSON data passed from Claude Code
input=$(cat)

# Get the path to the conversation transcript
transcript_path=$(echo "$input" | jq -r '.transcript_path')

# Get the content of the very first user prompt in the session
# Transcripts are JSONL, so we read the first line.
summary=$(head -n 1 "$transcript_path" | jq -r '.message.content[0].text // .content[0].text // .message // .content // "Claude Code task completed"' | cut -c 1-100)

# Handle case where summary is null or empty
if [ "$summary" = "null" ] || [ -z "$summary" ]; then
    summary="Claude Code task completed"
fi

# Send the notification
osascript -e "display notification \"$summary\" with title \"ClaudeCode Task Done\" sound name \"Hero\""
