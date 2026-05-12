"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { QrCode } from "lucide-react";

type QRCodeButtonProps = {
    uuid: string;
};

export default function QRCodeButton({
    uuid,
}: QRCodeButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const selfUrl =
        typeof window !== "undefined"
            ? window.location.origin
            : "";

    const qrUrl = `${selfUrl}/register/${uuid}`;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                  className="flex items-center justify-center rounded bg-black p-2 text-white transition hover:opacity-80"
            >
                <QrCode size={18} />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-start justify-between">
                            <h2 className="text-xl font-semibold">
                                QR-Code
                            </h2>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mt-6 flex justify-center rounded-xl bg-white p-4">
                            <QRCode
                                size={220}
                                value={qrUrl}
                            />
                        </div>

                        <p className="mt-4 break-all text-center text-sm text-gray-500">
                            {qrUrl}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}