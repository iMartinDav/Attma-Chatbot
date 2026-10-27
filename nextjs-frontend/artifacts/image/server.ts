import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { generateImage } from 'ai';

export const imageDocumentHandler = createDocumentHandler<'image'>({
  kind: 'image',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    try {
      const { image } = await generateImage({
        model: myProvider.imageModel('image-model'),
        prompt: title,
        n: 1,
      });

      draftContent = image.base64;

      dataStream.write({
        type: 'data-imageDelta',
        data: image.base64,
        transient: true,
      });
    } catch (error) {
      console.error('Image generation failed:', error);
      // Return placeholder on error
      draftContent = '';
    }

    return draftContent;
  },
  onUpdateDocument: async ({ description, dataStream }) => {
    let draftContent = '';

    try {
      const { image } = await generateImage({
        model: myProvider.imageModel('image-model'),
        prompt: description,
        n: 1,
      });

      draftContent = image.base64;

      dataStream.write({
        type: 'data-imageDelta',
        data: image.base64,
        transient: true,
      });
    } catch (error) {
      console.error('Image update failed:', error);
      draftContent = '';
    }

    return draftContent;
  },
});
