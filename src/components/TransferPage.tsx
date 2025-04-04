"use client";

import { useState, useRef, useEffect } from 'react';
import { formatFileSize, showToast } from '@/utils/helpers';

interface FileItem {
  file: File;
  id: string;
}

interface ReceivedFile {
  name: string;
  size: number;
  url: string;
  type: string;
  id: string;
}

interface ReceivedText {
  content: string;
  timestamp: string;
  id: string;
}

interface TransferPageProps {
  connectionStatus: string;
  onReceivedData: (data: any) => void;
  sendData: (data: any) => boolean;
  receivedFiles: ReceivedFile[];
  receivedTexts: ReceivedText[];
  onDisconnect?: () => void;
}

export default function TransferPage({
  connectionStatus,
  onReceivedData,
  sendData,
  receivedFiles,
  receivedTexts,
  onDisconnect
}: TransferPageProps) {
  // 状态管理
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [textInput, setTextInput] = useState('');
  const [transferProgress, setTransferProgress] = useState<number>(0);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragAreaRef = useRef<HTMLDivElement>(null);
  
  // 处理文件选择
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newFiles = Array.from(files).map(file => ({
      file,
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    }));
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };
  
  // 移除选中的文件
  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== id));
  };
  
  // 发送文件
  const sendFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsTransferring(true);
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;
    
    for (const fileItem of selectedFiles) {
      try {
        const file = fileItem.file;
        const arrayBuffer = await file.arrayBuffer();
        
        // 准备文件元数据
        const fileData = {
          type: 'file',
          name: file.name,
          size: file.size,
          dataType: file.type || 'application/octet-stream',
          data: arrayBuffer
        };
        
        // 发送文件数据
        if (sendData(fileData)) {
          completedFiles++;
          setTransferProgress((completedFiles / totalFiles) * 100);
          showToast(`正在发送: ${file.name}`);
        } else {
          showToast('发送失败，请检查连接', true);
          setIsTransferring(false);
          return;
        }
      } catch (error) {
        console.error('读取文件失败:', error);
        showToast('文件发送失败', true);
        setIsTransferring(false);
        return;
      }
    }
    
    // 清空文件列表
    setSelectedFiles([]);
    setTransferProgress(0);
    setIsTransferring(false);
    showToast('文件发送完成');
  };
  
  // 发送文本
  const sendText = () => {
    if (!textInput.trim()) return;
    
    // 准备文本数据
    const textData = {
      type: 'text',
      content: textInput.trim(),
      timestamp: new Date().toISOString()
    };
    
    // 发送文本数据
    if (sendData(textData)) {
      // 清空输入框
      setTextInput('');
      showToast('文本发送成功');
    } else {
      showToast('发送失败，请检查连接', true);
    }
  };
  
  // 复制图片到剪贴板
  const copyImageToClipboard = async (url: string, fileName: string) => {
    try {
      // 检查 Clipboard API 是否可用
      if (!navigator.clipboard) {
        console.error('浏览器不支持 Clipboard API');
        showToast('您的浏览器不支持复制功能，请手动下载图片', true);
        return;
      }

      const response = await fetch(url);
      const blob = await response.blob();
      
      try {
        // 检查 ClipboardItem 是否可用
        if (typeof ClipboardItem === 'undefined') {
          throw new Error('ClipboardItem 不受支持');
        }

        // 尝试使用新的 Clipboard API
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        showToast(`已复制图片 ${fileName}`);
      } catch (err) {
        console.error('复制到剪贴板失败:', err);
        
        // 退化方案：创建一个临时链接并打开图片
        const tempLink = document.createElement('a');
        tempLink.href = url;
        tempLink.target = '_blank';
        tempLink.click();
        
        showToast('无法直接复制图片，已在新窗口打开，请手动复制', true);
      }
    } catch (e) {
      console.error('无法获取图片数据:', e);
      showToast('复制失败，请手动下载图片', true);
    }
  };

  // 复制文本到剪贴板
  const copyTextToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast('文本已复制到剪贴板');
      })
      .catch(err => {
        console.error('复制文本失败:', err);
        showToast('复制失败，请手动选择并复制', true);
      });
  };

  // 设置拖放区域事件
  useEffect(() => {
    if (!dragAreaRef.current) return;
    
    const dragArea = dragAreaRef.current;
    
    // 阻止默认拖放行为
    const preventDefaults = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    // 高亮拖放区域
    const highlight = () => {
      dragArea.classList.add('highlight');
    };
    
    // 取消高亮拖放区域
    const unhighlight = () => {
      dragArea.classList.remove('highlight');
    };
    
    // 处理拖放文件
    const handleDrop = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (dt && dt.files.length > 0) {
        handleFileSelect(dt.files);
      }
    };
    
    // 添加事件监听器
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dragArea.addEventListener(eventName, preventDefaults as EventListener);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dragArea.addEventListener(eventName, highlight);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dragArea.addEventListener(eventName, unhighlight);
    });
    
    dragArea.addEventListener('drop', handleDrop as EventListener);
    
    // 清理事件监听器
    return () => {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dragArea.removeEventListener(eventName, preventDefaults as EventListener);
      });
      
      ['dragenter', 'dragover'].forEach(eventName => {
        dragArea.removeEventListener(eventName, highlight);
      });
      
      ['dragleave', 'drop'].forEach(eventName => {
        dragArea.removeEventListener(eventName, unhighlight);
      });
      
      dragArea.removeEventListener('drop', handleDrop as EventListener);
    };
  }, []);
  
  // 图片预览点击放大
  const handleImageClick = (url: string) => {
    window.open(url, '_blank');
  };
  
  return (
    <>
      <div className="status-bar">
        <p>状态: <span className={connectionStatus.includes('已连接') ? 'connected-text' : ''}>{connectionStatus}</span></p>
        {onDisconnect && (
          <div className="status-actions">
            <button className="disconnect-btn" onClick={onDisconnect}>
              <span>断开连接</span>
            </button>
          </div>
        )}
      </div>
      
      <div className="transfer-container">
        <h2>第二步：传输内容</h2>
        
        <div className="tabs">
          <button 
            className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`} 
            onClick={() => setActiveTab('file')}
          >
            文件
          </button>
          <button 
            className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            文本
          </button>
        </div>
        
        <div className="tab-content">
          <div id="file" className={`tab-pane ${activeTab === 'file' ? 'active' : ''}`}>
            <div className="drag-area" 
              ref={dragAreaRef}
            >
              <span className="upload-icon">📤</span>
              <p>拖放文件到这里或</p>
              <label htmlFor="file-input" className="file-label">选择文件</label>
              <input 
                type="file" 
                id="file-input" 
                multiple 
                hidden 
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
            
            <div id="file-list" className="file-list">
              {selectedFiles.map((fileItem) => (
                <div key={fileItem.id} className="file-item">
                  <div className="file-info">
                    <span className="file-icon">
                      {fileItem.file.type.startsWith('image/') ? '🖼️' : 
                       fileItem.file.type.includes('pdf') ? '📑' :
                       fileItem.file.type.includes('word') ? '📝' :
                       fileItem.file.type.includes('excel') || fileItem.file.type.includes('sheet') ? '📊' :
                       fileItem.file.type.includes('video') ? '🎬' :
                       fileItem.file.type.includes('audio') ? '🎵' : '📄'}
                    </span>
                    <span className="file-name">{fileItem.file.name}</span>
                    <span className="file-size">{formatFileSize(fileItem.file.size)}</span>
                  </div>
                  <span 
                    className="file-remove" 
                    onClick={() => removeFile(fileItem.id)}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>
            
            {isTransferring && (
              <div className="transfer-progress">
                <div className="progress-bar" style={{ width: `${transferProgress}%` }}></div>
              </div>
            )}
            
            <button 
              id="send-files-btn" 
              className="btn" 
              disabled={selectedFiles.length === 0 || isTransferring}
              onClick={sendFiles}
            >
              {isTransferring ? '发送中...' : '发送文件'}
            </button>
          </div>
          
          <div id="text" className={`tab-pane ${activeTab === 'text' ? 'active' : ''}`}>
            <textarea 
              id="text-input" 
              placeholder="输入要发送的文本..." 
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.ctrlKey && e.key === 'Enter' && sendText()}
            ></textarea>
            <div className="send-hint">提示：按 Ctrl+Enter 快速发送</div>
            <button 
              id="send-text-btn" 
              className="btn" 
              disabled={!textInput.trim()}
              onClick={sendText}
            >
              发送文本
            </button>
          </div>
        </div>
      </div>
      
      <div className="received-panel">
        <h2>已接收内容</h2>
        <div id="received-files" className="received-items">
          {receivedFiles.length > 0 ? (
            receivedFiles.map((file) => {
              const isImage = file.type.startsWith('image/');
              
              return (
                <div key={file.id} className="received-item">
                  <div className="file-info">
                    <span className="file-icon">
                      {file.type.startsWith('image/') ? '🖼️' : 
                       file.type.includes('pdf') ? '📑' :
                       file.type.includes('word') ? '📝' :
                       file.type.includes('excel') || file.type.includes('sheet') ? '📊' :
                       file.type.includes('video') ? '🎬' :
                       file.type.includes('audio') ? '🎵' : '📄'}
                    </span>
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  
                  {isImage && (
                    <div className="image-preview" onClick={() => handleImageClick(file.url)}>
                      <img 
                        src={file.url} 
                        alt={file.name} 
                        style={{ maxWidth: '200px', maxHeight: '200px', margin: '10px 0' }}
                      />
                    </div>
                  )}
                  
                  <div className="file-actions">
                    <a href={file.url} download={file.name} className="btn-small download">下载</a>
                    {isImage && (
                      <button 
                        className="btn-small copy-image" 
                        onClick={() => copyImageToClipboard(file.url, file.name)}
                      >
                        复制图片
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <div className="icon">📥</div>
              <p>还没有接收到任何文件</p>
            </div>
          )}
        </div>
        
        <div id="received-text" className="received-items">
          {receivedTexts.length > 0 ? (
            receivedTexts.map((text) => (
              <div key={text.id} className="received-item received-text">
                <div className="text-content">{text.content}</div>
                <div className="text-footer">
                  <small>{new Date(text.timestamp).toLocaleString()}</small>
                  <button 
                    className="btn-small copy-text"
                    onClick={() => copyTextToClipboard(text.content)}
                    title="复制文本"
                  >
                    复制
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="icon">💬</div>
              <p>还没有接收到任何文本消息</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 