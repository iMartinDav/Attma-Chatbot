'use client';

import type { Attachment, ChatRequestOptions, CreateMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { sanitizeUIMessages } from '@/lib/utils';
import { ArrowUpIcon, PaperclipIcon, StopIcon } from '../icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import equal from 'fast-deep-equal';
import { DragAndDrop } from '../drag-and-drop';
import { MessageSearch, type SearchMessage } from './message-search';
import { useBioflowTaskStatus } from '@/hooks/useBioflowTaskStatus';

type Message = SearchMessage;

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages: _messages,
  setMessages,
  append: _append,
  handleSubmit,
  className,
  isFullSize,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<Message>;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  className?: string;
  isFullSize: boolean;
}) {
  // Refs and state management
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { width } = useWindowSize();
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );
  const [bioflowTaskId, setBioflowTaskId] = useState<string | null>(null);
  const bioflowStatus = useBioflowTaskStatus(bioflowTaskId ?? undefined);

  /**
   * Adjusts textarea height based on content
   */
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, []);

  /**
   * Resets textarea to default height
   */
  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  }, []);

  // Initialize textarea with saved input
  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
  }, [adjustHeight, localStorageInput, setInput]);

  // Save input to localStorage
  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  // Input change handler
  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
      adjustHeight();
    },
    [setInput, adjustHeight],
  );

  // Initialize search functionality
  const { handleSearch, SearchButton } = MessageSearch({
    isSearchMode,
    isSearching,
    setIsSearchMode,
    input,
    setInput,
    resetHeight,
    setMessages,
    disabled: isLoading,
    chatId,
  });

  /**
   * Submit handler for both normal chat and search
   */
  const submitForm = useCallback(() => {
    // Update URL with chat ID
    window.history.replaceState({}, '', `/chat/${chatId}`);

    // Handle search mode
    if (isSearchMode) {
      const queryText = input.trim();
      if (!queryText) {
        toast.error('Please enter a search query');
        return;
      }

      // Reset inputs
      setInput('');
      setLocalStorageInput('');
      resetHeight();

      // Use specialized search handler
      handleSearch(queryText);
      return;
    }

    // Normal chat flow
    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    // Reset inputs and UI
    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();

    // Focus on input after sending
    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    chatId,
    handleSearch,
    handleSubmit,
    input,
    isSearchMode,
    resetHeight,
    setAttachments,
    setInput,
    setLocalStorageInput,
    width,
  ]);

  /**
   * File upload handler for different file types
   * @returns A properly typed Attachment object or undefined if upload fails
   */
  const uploadFile = useCallback(
    async (file: File): Promise<Attachment | undefined> => {
      const formData = new FormData();
      formData.append('file', file);

      // Determine appropriate upload endpoint based on file type
      let uploadUrl = '/api/files/upload';

      // Check for bioinformatics file types
      const bioinformaticsExtensions = [
        '.fastq',
        '.bam',
        '.vcf',
        '.mtx',
        '.h5ad',
        '.h5',
        '.hdf5',
        '.dgz',   // Added .dgz explicitly
      ];
      
      // Additional supported formats for bioflow
      const documentExtensions = [
        '.csv',
        '.tsv',
      ];
      
      const fileExtension = file.name
        .substring(file.name.lastIndexOf('.'))
        .toLowerCase();
        
      // File type detection
      const isZipFile =
        file.type === 'application/zip' || file.name.endsWith('.zip');
      const isGzipFile = 
        file.type === 'application/gzip' || 
        file.name.endsWith('.gz') || 
        file.name.endsWith('.tgz');
      const isTarFile = file.name.endsWith('.tar');
      const isBioinformaticsFile = bioinformaticsExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      );
      const isDocumentFile = documentExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      );
      const isPdfFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      
      // Enhanced text file detection - more thorough checking
      const isTextFile = 
        file.type === 'text/plain' || 
        file.name.toLowerCase().endsWith('.txt') ||
        file.type === 'text/markdown' ||
        file.name.toLowerCase().endsWith('.md') ||
        file.type === 'text/csv' ||
        file.name.toLowerCase().endsWith('.text');
      
      // File size in megabytes
      const fileSizeMB = file.size / (1024 * 1024);
      const isLargeFile = fileSizeMB > 5;

      // Handle specific file types
      if (file.type.startsWith('image/')) {
        uploadUrl = '/api/files/upload/image';
      } else if (isPdfFile && fileSizeMB <= 10) {
        uploadUrl = '/api/files/upload/pdf';
      } else if (isTextFile && fileSizeMB <= 25) {
        uploadUrl = '/api/files/upload/text';
        console.log('Uploading text file to dedicated text endpoint:', file.name);
      } else if (isZipFile || isGzipFile || isTarFile || isBioinformaticsFile || 
                (isPdfFile && fileSizeMB > 10) || // Large PDFs go to bioflow
                (isTextFile && fileSizeMB > 25) || // Large text files go to bioflow
                isDocumentFile || isLargeFile) {
        uploadUrl = '/api/files/upload/bioflow/upload';
        
        // Check file size limits for bioflow uploads - warn if possibly too large
        if (fileSizeMB > 200) {
          toast.warning(`Very large file (${fileSizeMB.toFixed(1)}MB). The server might reject it.`);
        } else if (isLargeFile) {
          toast.info(`Large file detected (${fileSizeMB.toFixed(1)}MB). Processing may take longer.`);
        }
        
        // Add descriptive file type information to help users understand processing
        if (isPdfFile) {
          toast.info('Processing PDF through the bioflow pipeline');
        } else if (isTextFile) {
          toast.info('Processing text file through the bioflow pipeline');
        } else if (file.name.toLowerCase().endsWith('.dgz')) {
          toast.info('Processing Cell Ranger Loupe file (.dgz)');
        }
        
        // Add metadata to formData to help the backend process the file correctly
        formData.append('fileType', fileExtension);
        formData.append('isCompressed', String(isZipFile || isGzipFile || isTarFile));
        formData.append('needsProcessing', 'true');
        formData.append('fileSizeMB', fileSizeMB.toString());
      }

      // Track analytics for uploads
      try {
        // Optional: Add analytics tracking here
        console.debug(`Upload initiated: ${file.name} (${fileSizeMB.toFixed(2)}MB) to ${uploadUrl}`);
      } catch (analyticsError) {
        // Non-critical error, just log it
        console.warn('Failed to track upload analytics:', analyticsError);
      }

      // Implement upload with retry logic
      const MAX_RETRIES = 2;
      let retries = 0;
      
      while (retries <= MAX_RETRIES) {
        try {
          // Set appropriate timeout based on file size
          const timeoutMs = isLargeFile ? 
            Math.min(300000, Math.max(120000, fileSizeMB * 2000)) : // 2 seconds per MB, min 2min, max 5min
            30000; // 30 seconds for small files
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            credentials: 'include' // Include auth credentials
          });
          
          // Clear the timeout since the request completed
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            
            // If this is a bioflow upload, capture the task_id for polling
            if (uploadUrl.includes('bioflow') && data.backendTask?.task_id) {
              setBioflowTaskId(data.backendTask.task_id);
              
              // Log successful bioflow job submission
              console.debug(`Bioflow task created: ${data.backendTask.task_id}`);
            }

            // Show appropriate success message
            toast.success(`File "${file.name}" uploaded successfully`);

            return {
              url: data.url,
              name: data.pathname || file.name,
              contentType: data.contentType || file.type,
            };
          }

          // Handle specific error cases with user-friendly messages
          if (response.status === 413) {
            toast.error(`File is too large (${fileSizeMB.toFixed(1)}MB). Maximum allowed size is 200MB.`);
            return undefined;
          }
          
          if (response.status === 401) {
            toast.error('Session expired. Please refresh the page and try again.');
            return undefined;
          }
          
          if (response.status === 500) {
            // Extract detailed error information
            try {
              const errorData = await response.json();
              const errorMessage = errorData.detail || errorData.error || 'Unknown server error';
              console.error('Server error details:', errorData);
              
              // If we have retries left, try again
              if (retries < MAX_RETRIES) {
                retries++;
                toast.info(`Upload retry ${retries}/${MAX_RETRIES} for "${file.name}"...`);
                // Exponential backoff: 1s, 2s, 4s...
                await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** (retries - 1))));
                continue;
              }
              
              toast.error(`Server error: ${errorMessage}`);
            } catch (jsonError) {
              toast.error(`Server error processing ${file.name}. The file might be corrupted or in an unsupported format.`);
            }
            return undefined;
          }
          
          // Handle other error cases
          try {
            const errorData = await response.json();
            toast.error(errorData.detail || errorData.error || `Failed to upload file (${response.status})`);
          } catch (jsonError) {
            toast.error(`Error (${response.status}): Failed to upload file`);
          }
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            return undefined;
          }
          
          // For other errors, retry if we haven't exceeded MAX_RETRIES
          if (retries < MAX_RETRIES) {
            retries++;
            toast.info(`Upload retry ${retries}/${MAX_RETRIES} for "${file.name}"...`);
            // Exponential backoff: 1s, 2s, 4s...
            await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** (retries - 1))));
            continue;
          }
          
          return undefined;
        } catch (error) {
          // Clear any timeout if it exists
          
          // Handle specific abort errors
          if (
            typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            (error as { name?: unknown }).name === 'AbortError'
          ) {
            toast.error(`Upload timed out for "${file.name}" (${fileSizeMB.toFixed(1)}MB). Try a smaller file or check your connection.`);
            return undefined;
          } 
          
          // For network errors, retry if possible
          if (retries < MAX_RETRIES) {
            retries++;
            toast.info(`Upload retry ${retries}/${MAX_RETRIES} for "${file.name}"...`);
            // Exponential backoff: 1s, 2s, 4s...
            await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** (retries - 1))));
            continue;
          }
          
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}. Please check your connection and try again.`);
          return undefined;
        }
      }
      
      // If we've exhausted all retries
      console.error(`Upload failed after ${MAX_RETRIES} retries:`, file.name);
      return undefined;
    },
    [],
  );

  /**
   * Handles file selection from input
   */
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      // Show upload queue in UI
      setUploadQueue(files.map((file) => file.name));

      try {
        // Upload all files in parallel
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);

        // Filter out undefined values and ensure type safety
        const successfullyUploadedAttachments: Array<Attachment> =
          uploadedAttachments.filter(
            (attachment: Attachment | undefined): attachment is Attachment =>
              attachment !== undefined,
          );

        // Add new attachments to existing ones
        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files:', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile],
  );

  /**
   * Handles files dropped onto the input area
   */
  const handleFileDrop = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);

      // Show upload queue in UI
      setUploadQueue(fileArray.map((file) => file.name));

      try {
        // Upload all files in parallel
        const uploadPromises = fileArray.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);

        // Filter out undefined values and ensure type safety
        const successfullyUploadedAttachments: Array<Attachment> =
          uploadedAttachments.filter(
            (attachment: Attachment | undefined): attachment is Attachment =>
              attachment !== undefined,
          );

        // Add new attachments to existing ones
        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files:', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile],
  );

  /**
   * Remove an attachment from the list
   */
  const handleDeleteAttachment = useCallback(
    (attachment: Attachment) => {
      setAttachments((currentAttachments) =>
        currentAttachments.filter((a) => a.url !== attachment.url),
      );
    },
    [setAttachments],
  );

  // Render the input component
  return (
    <div
      className={`relative w-full flex flex-col items-center gap-4 ${isFullSize ? 'h-full' : 'max-w-4xl mx-auto'}`}
    >
      <div className={`w-full ${isFullSize ? 'h-full' : 'max-w-2xl relative'}`}>
        {/* Attachment previews */}
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div className="flex flex-row gap-2 overflow-x-scroll items-end mb-4">
            {attachments.map((attachment, index) => (
              <PreviewAttachment
                key={attachment.url || `attachment-${index}`}
                attachment={attachment}
                onDelete={handleDeleteAttachment}
              />
            ))}

            {uploadQueue.map((filename, index) => (
              <PreviewAttachment
                key={`upload-${index}-${filename}`}
                attachment={{
                  url: '',
                  name: filename,
                  contentType: '',
                }}
                isUploading={true}
              />
            ))}
          </div>
        )}

        {/* Input area with drag and drop */}
        <DragAndDrop onDrop={handleFileDrop} isFullSize={isFullSize}>
          <Textarea
            ref={textareaRef}
            placeholder={
              isSearchMode ? 'Search whit Attma...' : 'Ask Attma...'
            }
            value={input}
            onChange={handleInput}
            className={cx(
              'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700 w-full',
              className,
              isSearchMode && 'border-2 border-[#80f1e5]',
            )}
            rows={2}
            autoFocus
            suppressHydrationWarning={true}
            onKeyDown={(event) => {
              // Submit on Enter (without Shift)
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();

                if (isLoading) {
                  toast.error(
                    'Please wait for the model to finish its response!',
                  );
                } else {
                  submitForm();
                }
              }

              // Exit search mode on Escape
              if (event.key === 'Escape' && isSearchMode) {
                setIsSearchMode(false);
              }
            }}
          />
        </DragAndDrop>

        {/* Attachment and search buttons */}
        <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start">
          <AttachmentsButton
            fileInputRef={fileInputRef}
            isLoading={isLoading || isSearching}
          />
          <SearchButton />
        </div>

        {/* Send or stop button */}
        <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
          {isLoading ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <SendButton
              input={input}
              submitForm={submitForm}
              uploadQueue={uploadQueue}
              isSearchMode={isSearchMode}
            />
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {/* Bioflow status panel - only show if a bioflow task is active */}
      {bioflowTaskId && (
        <div className="mt-2">
          {bioflowStatus.isLoading && <div>Processing file...</div>}
          {bioflowStatus.status === 'completed' && <div>Analysis complete! {/* Add result link if available */}</div>}
          {bioflowStatus.status === 'failed' && <div>Error: {bioflowStatus.error}</div>}
        </div>
      )}
    </div>
  );
}

// Optimize rendering with memoization
export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    // Only re-render when these props change
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    return true;
  },
);

/**
 * Button for adding attachments
 */
function PureAttachmentsButton({
  fileInputRef,
  isLoading,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  isLoading: boolean;
}) {
  return (
    <Button
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-[#80f1e5] hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={isLoading}
      variant="ghost"
      aria-label="Add attachment"
      title="Add attachment"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

/**
 * Button for stopping generation
 */
function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<Message>>>;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages(
          (messages) => sanitizeUIMessages(messages) as SearchMessage[],
        );
      }}
      aria-label="Stop generating"
      title="Stop generating"
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

/**
 * Button for sending messages
 */
function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  isSearchMode,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  isSearchMode: boolean;
}) {
  const buttonType = isSearchMode ? 'Search' : 'Send message';

  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
      aria-label={buttonType}
      title={buttonType}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.isSearchMode !== nextProps.isSearchMode) return false;
  return true;
});
