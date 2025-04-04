"use client";

import { useState, useEffect, useRef } from 'react';
import ConnectionPanel from './ConnectionPanel';
import usePeerConnection from '@/hooks/usePeerConnection';
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

export default function FileTransfer() {
  // 状态管理
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<ReceivedText[]>([]);
  const [textInput, setTextInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragAreaRef = useRef<HTMLDivElement>(null);
  
  // 使用自定义钩子处理PeerJS连接
  const { myPeerId, connectionStatus, connection, connectToPeer, sendData } = usePeerConnection({
    onData: handleReceivedData
  });
  
  // 处理接收的数据
  function handleReceivedData(data: any) {
    if (data.type === 'file') {
      // 接收文件
      const blob = new Blob([data.data], { type: data.dataType });
      const url = URL.createObjectURL(blob);
      
      setReceivedFiles(prev => [...prev, {
        name: data.name,
        size: data.size,
        url,
        type: data.dataType,
        id: Date.now().toString()
      }]);
    } else if (data.type === 'text') {
      // 接收文本
      setReceivedTexts(prev => [...prev, {
        content: data.content,
        timestamp: new Date(data.timestamp).toLocaleString(),
        id: Date.now().toString()
      }]);
    }
  }
  
  // 初始化拖放文件功能
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
    if (!connection || selectedFiles.length === 0) return;
    
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
        sendData(fileData);
      } catch (error) {
        console.error('读取文件失败:', error);
        showToast('文件发送失败', true);
      }
    }
    
    // 清空文件列表
    setSelectedFiles([]);
    showToast('文件发送完成');
  };
  
  // 发送文本
  const sendText = () => {
    if (!connection || !textInput.trim()) return;
    
    // 准备文本数据
    const textData = {
      type: 'text',
      content: textInput.trim(),
      timestamp: new Date().toISOString()
    };
    
    // 发送文本数据
    sendData(textData);
    
    // 清空输入框
    setTextInput('');
    showToast('文本发送成功');
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
  
  return (
    <>
      <ConnectionPanel 
        myPeerId={myPeerId} 
        connectionStatus={connectionStatus} 
        onConnect={connectToPeer} 
      />
      
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
          <div className="drag-area" ref={dragAreaRef}>
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
                  <span className="file-icon">📄</span>
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
          
          <button 
            id="send-files-btn" 
            className="btn" 
            disabled={!connection || selectedFiles.length === 0}
            onClick={sendFiles}
          >
            发送文件
          </button>
        </div>
        
        <div id="text" className={`tab-pane ${activeTab === 'text' ? 'active' : ''}`}>
          <textarea 
            id="text-input" 
            placeholder="输入要发送的文本..." 
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          ></textarea>
          <button 
            id="send-text-btn" 
            className="btn" 
            disabled={!connection || !textInput.trim()}
            onClick={sendText}
          >
            发送文本
          </button>
        </div>
      </div>
      
      <div className="received-panel">
        <h2>已接收内容</h2>
        <div id="received-files" className="received-items">
          {receivedFiles.map((file) => {
            const isImage = file.type.startsWith('image/');
            
            return (
              <div key={file.id} className="received-item">
                <div className="file-info">
                  <span className="file-icon">{isImage ? '🖼️' : '📄'}</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                
                {isImage && (
                  <div className="image-preview">
                    <img 
                      src={file.url} 
                      alt={file.name} 
                      style={{ maxWidth: '200px', maxHeight: '200px', margin: '10px 0' }}
                    />
                  </div>
                )}
                
                <div className="file-actions">
                  <a href={file.url} download={file.name} className="btn-small">下载</a>
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
          })}
        </div>
        
        <div id="received-text" className="received-items">
          {receivedTexts.map((text) => (
            <div key={text.id} className="received-text">
              <div>{text.content}</div>
              <small>{text.timestamp}</small>
            </div>
          ))}
        </div>
      </div>
    </>
  );
} 