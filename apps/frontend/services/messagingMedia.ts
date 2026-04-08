import { Platform } from "react-native";
import api from "@/services/schedulingApi";
import { extractChatbotErrorMessage } from "@/utils/chatbotError";

export interface SelectedMessageImage {
  file?: Blob;
  mimeType: string;
  name: string;
  uri?: string;
}

const sanitizeFileName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, "-");

const readUriAsBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Unable to read selected image");
  }

  return response.blob();
};

const readBlobAsBase64 = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Unable to read selected image"));
    };

    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read selected image"));
        return;
      }

      const commaIndex = reader.result.indexOf(",");
      resolve(
        commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result,
      );
    };

    reader.readAsDataURL(blob);
  });

export const pickMessageImageFromDevice =
  async (): Promise<SelectedMessageImage | null> => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return null;
    }

    return new Promise((resolve) => {
      let settled = false;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.position = "fixed";
      input.style.opacity = "0";
      input.style.pointerEvents = "none";
      input.style.width = "1px";
      input.style.height = "1px";
      document.body.appendChild(input);

      const cleanup = () => {
        window.removeEventListener("focus", handleWindowFocus, true);
        input.remove();
      };

      const finish = (result: SelectedMessageImage | null) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(result);
      };

      const handleWindowFocus = () => {
        window.setTimeout(() => {
          if (!input.files?.length) {
            finish(null);
          }
        }, 300);
      };

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }

        finish({
          file,
          mimeType: file.type || "image/jpeg",
          name: file.name || `message-image-${Date.now()}.jpg`,
        });
      };

      input.oncancel = () => finish(null);
      window.addEventListener("focus", handleWindowFocus, true);
      input.click();
    });
  };

export const uploadMessagingImage = async (
  image: SelectedMessageImage,
  conversationId: string,
  _senderId: string,
): Promise<string> => {
  const fileBlob =
    image.file || (image.uri ? await readUriAsBlob(image.uri) : null);

  if (!fileBlob) {
    throw new Error("No image file was provided");
  }

  const fileName = sanitizeFileName(image.name || `message-${Date.now()}.jpg`);
  const mimeType = image.mimeType || "image/jpeg";
  const dataBase64 = await readBlobAsBase64(fileBlob);

  try {
    const response = await api.post<{ image_url: string }>(
      `/api/messaging/conversations/${conversationId}/image-upload`,
      {
        file_name: fileName,
        content_type: mimeType,
        data_base64: dataBase64,
      },
    );

    return response.data.image_url;
  } catch (error) {
    const detailedMessage =
      extractChatbotErrorMessage(
        (error as { response?: { data?: unknown } })?.response?.data,
      ) ||
      (error instanceof Error ? error.message : "Unable to upload image.");

    throw new Error(detailedMessage);
  }
};
