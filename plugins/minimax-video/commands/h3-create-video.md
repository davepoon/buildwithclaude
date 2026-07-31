---
description: Create a MiniMax-H3 multimodal video task with validated v2 inputs.
category: integration-sync
argument-hint: <prompt> [media and options] [--region global|cn]
allowed-tools: Bash
---

# Create H3 Video

Create an asynchronous MiniMax-H3 video-generation task from text and optional
image, video, or audio inputs. Read the user's prompt and options from
<code>$ARGUMENTS</code>, then build the v2 JSON request described below.

## Supported options

- <code>--first-frame URL</code> and <code>--last-frame URL</code> create frame
  inputs.
- <code>--reference-image URL</code>, <code>--reference-video URL</code>, and
  <code>--reference-audio URL</code> may be repeated to create reference inputs.
- <code>--duration N</code>, <code>--resolution 2K</code>, and
  <code>--ratio VALUE</code> control the generated output.
- <code>--callback-url URL</code> adds a callback.
- <code>--region global|cn</code> selects the endpoint. The
  <code>--aigc-watermark true|false</code> option is valid only with cn.

## Build the content array

Every request must contain exactly one non-empty text item. Add media items only
when the user supplies them:

~~~json
{
  "type": "text",
  "text": "Describe the desired video here."
}
~~~

Use these shapes for media items:

~~~json
{
  "type": "image_url",
  "image_url": { "url": "https://example.com/first-frame.jpg" },
  "role": "first_frame"
}
~~~

~~~json
{
  "type": "video_url",
  "video_url": { "url": "https://example.com/reference.mp4" },
  "role": "reference_video"
}
~~~

~~~json
{
  "type": "audio_url",
  "audio_url": { "url": "https://example.com/reference.mp3" },
  "role": "reference_audio"
}
~~~

Supported media types are <code>image_url</code>, <code>video_url</code>, and
<code>audio_url</code>. Supported roles are <code>first_frame</code>,
<code>last_frame</code>, <code>reference_image</code>,
<code>reference_video</code>, and <code>reference_audio</code>. A single
unlabelled image is treated as a first frame; label both images when using first
and last frames.

## Validate before the request

Stop with a concise validation error and do not call the API when any rule fails:

1. Set <code>model</code> to MiniMax-H3 and require one non-empty text item of at
   most 7000 characters.
2. Set <code>resolution</code> to exactly 2K. Reject every other resolution.
3. Require <code>duration</code> to be an integer from 4 through 15 inclusive.
   Reject missing, fractional, or out-of-range values.
4. Do not mix <code>first_frame</code> or <code>last_frame</code> with any
   <code>reference_image</code>, <code>reference_video</code>, or
   <code>reference_audio</code> role.
5. Reject a <code>last_frame</code> item unless the request also contains a
   <code>first_frame</code> item.
6. A <code>reference_audio</code> item requires at least one
   <code>reference_image</code> or <code>reference_video</code> item. Audio
   cannot be the only reference input.
7. Keep the complete request body at or below 64 MB. Prefer public or platform
   file URLs over large Base64 data when possible.
8. For text-only content, require a concrete <code>ratio</code> from 21:9, 16:9,
   4:3, 1:1, 3:4, or 9:16. For frame content, use adaptive. For reference
   content, use adaptive or one of the concrete ratios.

The optional <code>callback_url</code> may be included after validation. Select
the host from <code>--region</code>: global uses https://api.minimax.io; cn uses
https://api.minimaxi.com. Include the optional <code>aigc_watermark</code>
boolean only for cn requests.

## Request

~~~bash
# Set BASE_URL from --region before running this request.
curl -fsS -X POST "$BASE_URL/v2/video_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "content": [
      {
        "type": "text",
        "text": "A quiet mountain train crosses a bridge at sunrise."
      }
    ],
    "resolution": "2K",
    "duration": 5,
    "ratio": "16:9"
  }'
~~~

For China, add <code>"aigc_watermark": true</code> or
<code>"aigc_watermark": false</code> to the request body. Do not send that field
to the global endpoint.

On success, report the returned <code>task_id</code> and continue with
/minimax-video:h3-query-video task_id. A successful v2 create response is
identified by <code>task_id</code>; task status is returned by the query command.
