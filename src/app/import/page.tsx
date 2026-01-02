'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { Card, Button, Input, Select, Spinner, Badge } from '@/components/ui';
import {
    Upload,
    FileText,
    Lock,
    User,
    Check,
    AlertTriangle,
    ArrowRight,
    ArrowLeft,
    RefreshCw
} from 'lucide-react';

type Step = 'upload' | 'password' | 'owner' | 'preview' | 'importing' | 'complete';

interface ParsedTransaction {
    index: number;
    dateTime: string;
    amount: number;
    itemType: string;
    channel: string;
    description: string;
    isDuplicate: boolean;
}

interface ParsedData {
    transactions: {
        dateTime: string;
        amount: number;
        itemType: string;
        channel: string;
        descriptionRaw: string;
        fingerprint: string;
    }[];
    fileHash: string;
    statementMonth: string | null;
}

interface ImportResult {
    batchId: string;
    importedCount: number;
    skippedDuplicateCount: number;
    uncategorizedCount: number;
}

export default function ImportPage() {
    const { user, family } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [ownerId, setOwnerId] = useState(user?.id || '');
    const [statementMonth, setStatementMonth] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [preview, setPreview] = useState<ParsedTransaction[]>([]);
    const [summary, setSummary] = useState<{
        totalTransactions: number;
        duplicateCount: number;
        newTransactionCount: number;
    } | null>(null);
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [mergeMode, setMergeMode] = useState<'DEDUP' | 'REPLACE'>('DEDUP');

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
                setError('กรุณาเลือกไฟล์ PDF เท่านั้น');
                return;
            }
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('ไฟล์ใหญ่เกิน 10MB');
                return;
            }
            setFile(selectedFile);
            setError('');
        }
    };

    const uploadAndParse = useCallback(async (pwd?: string) => {
        if (!file) return;

        setIsLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);
        if (pwd) formData.append('password', pwd);
        formData.append('ownerId', ownerId || user?.id || '');

        try {
            const res = await fetch('/api/import/batch', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (data.step === 'PASSWORD_REQUIRED') {
                setStep('password');
            } else if (data.step === 'PASSWORD_INVALID') {
                setError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่');
            } else if (data.success) {
                setPreview(data.preview);
                setSummary(data.summary);
                setStatementMonth(data.statementMonth || '');
                setParsedData(data._parsedData);
                setStep('preview');
            } else {
                setError(data.error || 'ไม่สามารถอ่านไฟล์ได้');
            }
        } catch {
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }

        setIsLoading(false);
    }, [file, ownerId, user?.id]);

    const handleUpload = () => {
        if (!file) {
            setError('กรุณาเลือกไฟล์');
            return;
        }
        uploadAndParse();
    };

    const handlePasswordSubmit = () => {
        uploadAndParse(password);
    };

    const handleConfirmImport = async () => {
        if (!parsedData) return;

        setStep('importing');
        setError('');

        try {
            const res = await fetch('/api/import/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactions: parsedData.transactions,
                    fileHash: parsedData.fileHash,
                    statementMonth,
                    ownerId,
                    mergeMode,
                }),
            });

            const data = await res.json();

            if (data.success) {
                setImportResult(data.batch);
                setStep('complete');
            } else {
                setError(data.error || 'นำเข้าไม่สำเร็จ');
                setStep('preview');
            }
        } catch {
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            setStep('preview');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(amount);
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const ownerOptions = family?.members.map(m => ({
        value: m.userId,
        label: m.userId === user?.id ? `${m.name} (ฉัน)` : m.name,
    })) || [];

    const steps = [
        { id: 'upload', label: 'เลือกไฟล์' },
        { id: 'password', label: 'รหัสผ่าน' },
        { id: 'preview', label: 'ตรวจสอบ' },
        { id: 'complete', label: 'เสร็จสิ้น' },
    ];

    return (
        <ProtectedLayout>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white">นำเข้า Statement</h1>
                    <p className="text-gray-400">อัปโหลด Statement PDF จาก KBank</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8">
                    {steps.map((s, i) => (
                        <div key={s.id} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === s.id || steps.findIndex(x => x.id === step) > i
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-white/10 text-gray-500'
                                    }`}
                            >
                                {steps.findIndex(x => x.id === step) > i ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    i + 1
                                )}
                            </div>
                            <span className={`ml-2 text-sm hidden sm:block ${step === s.id ? 'text-white' : 'text-gray-500'
                                }`}>
                                {s.label}
                            </span>
                            {i < steps.length - 1 && (
                                <div className="w-12 sm:w-24 h-px bg-white/10 mx-4" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                {step === 'upload' && (
                    <Card className="animate-fadeIn">
                        <div className="text-center py-8">
                            <label className="file-label cursor-pointer block">
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileSelect}
                                />
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mb-4">
                                        <Upload className="w-8 h-8 text-violet-400" />
                                    </div>
                                    <p className="text-white font-medium mb-1">
                                        {file ? file.name : 'คลิกเพื่อเลือกไฟล์ PDF'}
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        รองรับ Statement รายเดือนจาก K PLUS (PDF ขนาดไม่เกิน 10MB)
                                    </p>
                                </div>
                            </label>

                            {file && (
                                <div className="mt-6 p-4 bg-white/5 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-8 h-8 text-violet-400" />
                                        <div className="text-left">
                                            <p className="text-white font-medium">{file.name}</p>
                                            <p className="text-gray-500 text-sm">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" onClick={() => setFile(null)}>
                                        ลบ
                                    </Button>
                                </div>
                            )}

                            {/* Owner Selection */}
                            {file && (
                                <div className="mt-6">
                                    <Select
                                        label="ค่าใช้จ่ายนี้เป็นของ"
                                        options={ownerOptions}
                                        value={ownerId || user?.id || ''}
                                        onChange={(e) => setOwnerId(e.target.value)}
                                    />
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <Button
                                className="mt-6"
                                size="lg"
                                onClick={handleUpload}
                                isLoading={isLoading}
                                disabled={!file}
                            >
                                อัปโหลดและตรวจสอบ
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 'password' && (
                    <Card className="animate-fadeIn">
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-8 h-8 text-amber-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                ไฟล์ PDF มีการป้องกันด้วยรหัสผ่าน
                            </h2>
                            <p className="text-gray-400 mb-6">
                                กรุณากรอกรหัสผ่านเพื่อเปิดไฟล์
                            </p>

                            <div className="max-w-xs mx-auto">
                                <Input
                                    type="password"
                                    placeholder="รหัสผ่าน PDF"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="text-center"
                                />
                            </div>

                            {error && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="mt-6 flex justify-center gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setStep('upload');
                                        setPassword('');
                                        setError('');
                                    }}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    กลับ
                                </Button>
                                <Button
                                    onClick={handlePasswordSubmit}
                                    isLoading={isLoading}
                                    disabled={!password}
                                >
                                    ปลดล็อคไฟล์
                                </Button>
                            </div>

                            <p className="text-gray-500 text-xs mt-6">
                                รหัสผ่านจะไม่ถูกบันทึก - ใช้สำหรับเปิดไฟล์ครั้งเดียวเท่านั้น
                            </p>
                        </div>
                    </Card>
                )}

                {step === 'preview' && summary && (
                    <Card className="animate-fadeIn">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-white">ตรวจสอบข้อมูล</h2>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-400">
                                    {family?.members.find(m => m.userId === ownerId)?.name}
                                </span>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-white/5 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-white">{summary.totalTransactions}</p>
                                <p className="text-gray-400 text-sm">รายการทั้งหมด</p>
                            </div>
                            <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-emerald-400">{summary.newTransactionCount}</p>
                                <p className="text-gray-400 text-sm">รายการใหม่</p>
                            </div>
                            <div className="bg-amber-500/10 rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-amber-400">{summary.duplicateCount}</p>
                                <p className="text-gray-400 text-sm">ซ้ำ (ข้าม)</p>
                            </div>
                        </div>

                        {/* Statement Month */}
                        <div className="mb-6">
                            <Input
                                label="เดือนของ Statement (YYYY-MM)"
                                type="month"
                                value={statementMonth}
                                onChange={(e) => setStatementMonth(e.target.value)}
                            />
                        </div>

                        {/* Preview Table */}
                        <div className="mb-6">
                            <p className="text-gray-400 text-sm mb-3">ตัวอย่างรายการ (10 รายการแรก)</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left py-2 px-3 text-gray-400">วันที่/เวลา</th>
                                            <th className="text-left py-2 px-3 text-gray-400">ประเภท</th>
                                            <th className="text-right py-2 px-3 text-gray-400">จำนวนเงิน</th>
                                            <th className="text-left py-2 px-3 text-gray-400">ช่องทาง</th>
                                            <th className="text-left py-2 px-3 text-gray-400">รายละเอียด</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((tx) => (
                                            <tr
                                                key={tx.index}
                                                className={`border-b border-white/5 ${tx.isDuplicate ? 'opacity-50' : ''}`}
                                            >
                                                <td className="py-2 px-3 text-white whitespace-nowrap">
                                                    {formatDateTime(tx.dateTime)}
                                                </td>
                                                <td className="py-2 px-3 text-gray-300">{tx.itemType}</td>
                                                <td className="py-2 px-3 text-white text-right font-medium">
                                                    {formatCurrency(tx.amount)}
                                                </td>
                                                <td className="py-2 px-3 text-gray-400">{tx.channel}</td>
                                                <td className="py-2 px-3 text-gray-400 max-w-[200px] truncate">
                                                    {tx.description}
                                                    {tx.isDuplicate && (
                                                        <Badge variant="warning" className="ml-2">ซ้ำ</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Merge Mode */}
                        {summary.duplicateCount > 0 && (
                            <div className="mb-6 p-4 bg-white/5 rounded-xl">
                                <p className="text-white font-medium mb-2">พบรายการซ้ำ</p>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="mergeMode"
                                            checked={mergeMode === 'DEDUP'}
                                            onChange={() => setMergeMode('DEDUP')}
                                        />
                                        <span className="text-gray-300">ข้ามรายการซ้ำ (แนะนำ)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="mergeMode"
                                            checked={mergeMode === 'REPLACE'}
                                            onChange={() => setMergeMode('REPLACE')}
                                        />
                                        <span className="text-gray-300">แทนที่ข้อมูลเดือนนี้</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <div className="flex justify-between">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setStep('upload');
                                    setFile(null);
                                    setPassword('');
                                    setPreview([]);
                                    setSummary(null);
                                    setParsedData(null);
                                    setError('');
                                }}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                เริ่มใหม่
                            </Button>
                            <Button
                                onClick={handleConfirmImport}
                                disabled={summary.newTransactionCount === 0}
                            >
                                นำเข้า {summary.newTransactionCount} รายการ
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 'importing' && (
                    <Card className="animate-fadeIn">
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                กำลังนำเข้าข้อมูล...
                            </h2>
                            <p className="text-gray-400">
                                กรุณารอสักครู่ ระบบกำลังประมวลผลและจัดหมวดหมู่อัตโนมัติ
                            </p>
                        </div>
                    </Card>
                )}

                {step === 'complete' && importResult && (
                    <Card className="animate-fadeIn">
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                นำเข้าสำเร็จ!
                            </h2>

                            <div className="grid grid-cols-3 gap-4 my-6">
                                <div className="bg-emerald-500/10 rounded-xl p-4">
                                    <p className="text-2xl font-bold text-emerald-400">
                                        {importResult.importedCount}
                                    </p>
                                    <p className="text-gray-400 text-sm">นำเข้าแล้ว</p>
                                </div>
                                <div className="bg-amber-500/10 rounded-xl p-4">
                                    <p className="text-2xl font-bold text-amber-400">
                                        {importResult.skippedDuplicateCount}
                                    </p>
                                    <p className="text-gray-400 text-sm">ข้ามซ้ำ</p>
                                </div>
                                <div className="bg-violet-500/10 rounded-xl p-4">
                                    <p className="text-2xl font-bold text-violet-400">
                                        {importResult.uncategorizedCount}
                                    </p>
                                    <p className="text-gray-400 text-sm">รอจัดหมวดหมู่</p>
                                </div>
                            </div>

                            <div className="flex justify-center gap-3">
                                {importResult.uncategorizedCount > 0 ? (
                                    <Button onClick={() => router.push('/expenses?uncategorizedOnly=true')}>
                                        จัดหมวดหมู่รายการ
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                ) : (
                                    <Button onClick={() => router.push('/dashboard')}>
                                        ไปที่ Dashboard
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                )}
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setStep('upload');
                                        setFile(null);
                                        setPassword('');
                                        setPreview([]);
                                        setSummary(null);
                                        setParsedData(null);
                                        setImportResult(null);
                                        setError('');
                                    }}
                                >
                                    นำเข้าไฟล์อื่น
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </ProtectedLayout>
    );
}
